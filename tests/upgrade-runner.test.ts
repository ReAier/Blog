import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Writable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import {
  CommandFailure,
  ProgressReporter,
  formatCommand,
  resolveExecutable,
  runCommand,
} from '../scripts/upgrade-runner';

class MemoryOutput extends Writable {
  value = '';
  isTTY: boolean;

  constructor(isTTY: boolean) {
    super();
    this.isTTY = isTTY;
  }

  override _write(
    chunk: Buffer | string,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ): void {
    this.value += chunk.toString();
    callback();
  }
}

describe('upgrade command resolution', () => {
  it('uses Windows executable shims only on Windows', () => {
    expect(resolveExecutable('npm', 'win32')).toBe('npm.cmd');
    expect(resolveExecutable('tar', 'win32')).toBe('tar.exe');
    expect(resolveExecutable('ssh', 'linux')).toBe('ssh');
    expect(resolveExecutable('scp', 'darwin')).toBe('scp');
  });

  it('quotes command arguments for diagnostics without invoking a shell', () => {
    expect(formatCommand('npm', ['run', 'check value'])).toBe('npm run "check value"');
  });

  it('truncates very long diagnostic arguments instead of dumping encoded scripts', () => {
    const formatted = formatCommand('ssh', ['server', 'x'.repeat(500)]);

    expect(formatted.length).toBeLessThan(260);
    expect(formatted).toContain('…');
    expect(formatted).not.toContain('x'.repeat(300));
  });
});

describe('quiet upgrade command execution', () => {
  it('does not write successful child output to the parent streams', async () => {
    const logs = await mkdtemp(join(tmpdir(), 'upgrade-runner-'));
    const output = new MemoryOutput(false);

    await expect(runCommand({
      step: 'fake success',
      file: process.execPath,
      args: ['-e', 'console.log("hidden output")'],
      cwd: process.cwd(),
      logDirectory: logs,
      output,
    })).resolves.toBeUndefined();

    expect(output.value).toBe('');
  });

  it('captures a bounded tail and keeps the full log after failure', async () => {
    const logs = await mkdtemp(join(tmpdir(), 'upgrade-runner-'));
    const failure = await runCommand({
      step: 'fake failure',
      file: process.execPath,
      args: [
        '-e',
        'console.error("prefix-" + "x".repeat(2000) + "-diagnostic marker"); process.exit(7)',
      ],
      cwd: process.cwd(),
      logDirectory: logs,
      tailLimit: 256,
    }).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(CommandFailure);
    expect(failure).toMatchObject({
      step: 'fake failure',
      exitCode: 7,
      hasMoreOutput: true,
    });
    expect((failure as CommandFailure).outputTail).toContain('diagnostic marker');
    expect((failure as CommandFailure).outputTail.length).toBeLessThanOrEqual(256);
    await expect(readFile((failure as CommandFailure).logPath, 'utf8'))
      .resolves.toContain('prefix-');
  });

  it('reports spawn failures as command failures', async () => {
    const logs = await mkdtemp(join(tmpdir(), 'upgrade-runner-'));
    const failure = await runCommand({
      step: 'missing executable',
      file: `missing-upgrade-command-${Date.now()}`,
      args: [],
      cwd: process.cwd(),
      logDirectory: logs,
    }).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(CommandFailure);
    expect(failure).toMatchObject({
      step: 'missing executable',
      exitCode: null,
    });
    expect((failure as CommandFailure).cause).toBeInstanceOf(Error);
  });

  it('wraps synchronous spawn validation errors with the failed step', async () => {
    const logs = await mkdtemp(join(tmpdir(), 'upgrade-runner-'));
    const failure = await runCommand({
      step: 'invalid executable',
      file: '\0invalid',
      args: [],
      cwd: process.cwd(),
      logDirectory: logs,
    }).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(CommandFailure);
    expect(failure).toMatchObject({
      step: 'invalid executable',
      exitCode: null,
    });
  });
});

describe('upgrade progress reporting', () => {
  it('renders an updating bar for interactive terminals', () => {
    const output = new MemoryOutput(true);
    const progress = new ProgressReporter(output);

    progress.start(1, 2, 'Check public site');
    progress.start(2, 2, 'Run tests');
    progress.succeed('Upgrade complete');

    expect(output.value).toContain('[--------------------]');
    expect(output.value).toContain('  0% Check public site');
    expect(output.value).toContain('[##########----------]');
    expect(output.value).toContain(' 50% Run tests');
    expect(output.value).toContain('\r\x1b[2K');
    expect(output.value).toContain('100% Upgrade complete');
  });

  it('prints one short line per step for non-interactive output', () => {
    const output = new MemoryOutput(false);
    const progress = new ProgressReporter(output);

    progress.start(1, 2, 'Check public site');
    progress.start(2, 2, 'Run tests');
    progress.succeed('Upgrade complete');

    expect(output.value.trim().split('\n')).toEqual([
      '[1/2] Check public site',
      '[2/2] Run tests',
      'Upgrade complete',
    ]);
    expect(output.value).not.toContain('\x1b');
  });

  it('clears an active TTY progress line before diagnostics', () => {
    const output = new MemoryOutput(true);
    const progress = new ProgressReporter(output);

    progress.start(1, 2, 'Check public site');
    progress.clear();

    expect(output.value.endsWith('\r\x1b[2K')).toBe(true);
  });
});
