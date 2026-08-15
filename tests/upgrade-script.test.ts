import { spawnSync } from 'node:child_process';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Writable } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import { CommandFailure } from '../scripts/upgrade-runner';
import {
  createUpgradePlan,
  parseUpgradeArgs,
  runUpgrade,
} from '../scripts/upgrade';

class MemoryOutput extends Writable {
  value = '';
  isTTY = false;

  override _write(
    chunk: Buffer | string,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ): void {
    this.value += chunk.toString();
    callback();
  }
}

describe('upgrade CLI arguments', () => {
  it('uses safe defaults', () => {
    expect(parseUpgradeArgs([])).toEqual({
      dryRun: false,
      sshHost: 'aliyun-aiopt',
    });
  });

  it.each([
    [['--dry-run'], { dryRun: true, sshHost: 'aliyun-aiopt' }],
    [['-DryRun'], { dryRun: true, sshHost: 'aliyun-aiopt' }],
    [['--ssh-host', 'example'], { dryRun: false, sshHost: 'example' }],
    [['-SshHost', 'example'], { dryRun: false, sshHost: 'example' }],
  ])('parses %j', (args, expected) => {
    expect(parseUpgradeArgs(args)).toEqual(expected);
  });

  it('rejects unknown or missing options', () => {
    expect(() => parseUpgradeArgs(['--unknown'])).toThrow('Unknown option: --unknown');
    expect(() => parseUpgradeArgs(['--ssh-host'])).toThrow('Missing value for --ssh-host');
  });

  it('prints argument errors once at the end of the CLI run', () => {
    const result = spawnSync(
      process.execPath,
      [join(process.cwd(), 'node_modules/tsx/dist/cli.mjs'), 'scripts/upgrade.ts', '--unknown'],
      { cwd: process.cwd(), encoding: 'utf8' },
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Upgrade failed');
    expect(result.stderr).toContain('Unknown option: --unknown');
    expect(result.stderr.match(/Upgrade failed/g)).toHaveLength(1);
  });
});

describe('upgrade deployment plan', () => {
  it('preserves the release steps, archive exclusions, and remote permissions', () => {
    const root = join(tmpdir(), 'upgrade project');
    const plan = createUpgradePlan(
      { dryRun: false, sshHost: 'server-alias' },
      { root, release: '20260815T120000Z', platform: 'linux' },
    );

    expect(plan.release).toBe('20260815T120000Z');
    expect(plan.archiveName).toBe('aier-blog-code-20260815T120000Z.tar.gz');
    expect(plan.remoteArchive).toBe('/tmp/aier-blog-code-20260815T120000Z.tar.gz');
    expect(plan.steps.map((step) => step.label)).toEqual([
      'Check public site',
      'Check admin application',
      'Run tests',
      'Build admin client',
      'Validate content',
      'Build public site',
      'Create upgrade archive',
      'Upload upgrade archive',
      'Activate remote release',
    ]);

    const archiveStep = plan.steps.find((step) => step.label === 'Create upgrade archive');
    expect(archiveStep?.file).toBe('tar');
    expect(archiveStep?.args).toEqual(expect.arrayContaining([
      '--exclude=.git',
      '--exclude=.astro',
      '--exclude=.deploy',
      '--exclude=.admin-data',
      '--exclude=.worktrees',
      '--exclude=.superpowers',
      '--exclude=.agents',
      '--exclude=.codex',
      '--exclude=AGENTS.md',
      '--exclude=*.log',
      '--exclude=.env*',
      '--exclude=.deploy-redirects.conf',
      '--exclude=node_modules',
      '--exclude=dist',
      '--exclude=admin/client/dist',
      '--exclude=src/content/blog',
      '--exclude=src/content/clips',
      '--exclude=src/content/images',
    ]));

    const activation = plan.steps.find((step) => step.label === 'Activate remote release');
    const encodedCommand = activation?.args.at(1)?.match(/^echo (.+) \| base64 -d \| bash$/)?.[1];
    expect(encodedCommand).toBeTruthy();
    const remoteScript = Buffer.from(encodedCommand ?? '', 'base64').toString('utf8');
    expect(remoteScript).toContain('find "$new" -type d -exec chmod 0755 {} +');
    expect(remoteScript).toContain('find "$new" -type f -exec chmod 0644 {} +');
    expect(remoteScript).toContain('chmod 0755 "$new"/deployment/*.sh');
    expect(remoteScript).toContain('bash deployment/install-code.sh "$release" "$archive"');
  });

  it('uses Windows executable names and stops dry runs before network commands', () => {
    const plan = createUpgradePlan(
      { dryRun: true, sshHost: 'server-alias' },
      {
        root: 'D:\\Blog',
        release: '20260815T120000Z',
        platform: 'win32',
        nodeExecutable: 'C:\\Node\\node.exe',
        npmCli: 'C:\\Node\\node_modules\\npm\\bin\\npm-cli.js',
      },
    );

    expect(plan.steps.at(0)).toMatchObject({
      file: 'C:\\Node\\node.exe',
      args: ['C:\\Node\\node_modules\\npm\\bin\\npm-cli.js', 'run', 'check'],
    });
    expect(plan.steps.at(-1)?.label).toBe('Create upgrade archive');
    expect(plan.steps.at(-1)?.file).toBe('tar.exe');
    expect(plan.steps.map((step) => step.file)).not.toContain('scp.exe');
    expect(plan.steps.map((step) => step.file)).not.toContain('ssh.exe');
  });
});

describe('upgrade orchestration', () => {
  it('runs every step in order and prints a concise success summary', async () => {
    const root = await mkdtemp(join(tmpdir(), 'upgrade-script-'));
    const output = new MemoryOutput();
    const calls: string[] = [];
    const runCommand = vi.fn(async (options: { step: string }) => {
      calls.push(options.step);
    });

    const result = await runUpgrade(
      { dryRun: false, sshHost: 'server-alias' },
      {
        root,
        release: '20260815T120000Z',
        platform: 'linux',
        output,
        errorOutput: output,
        runCommand,
      },
    );

    expect(calls).toEqual([
      'Check public site',
      'Check admin application',
      'Run tests',
      'Build admin client',
      'Validate content',
      'Build public site',
      'Create upgrade archive',
      'Upload upgrade archive',
      'Activate remote release',
    ]);
    expect(result.release).toBe('20260815T120000Z');
    expect(output.value).toContain('System upgrade complete: 20260815T120000Z');
    expect(output.value).not.toContain('npm run check');
  });

  it('runs a dry upgrade without upload or activation', async () => {
    const root = await mkdtemp(join(tmpdir(), 'upgrade-script-'));
    const output = new MemoryOutput();
    const calls: string[] = [];

    await runUpgrade(
      { dryRun: true, sshHost: 'server-alias' },
      {
        root,
        release: '20260815T120000Z',
        platform: 'linux',
        output,
        errorOutput: output,
        runCommand: async (options) => {
          calls.push(options.step);
        },
      },
    );

    expect(calls.at(-1)).toBe('Create upgrade archive');
    expect(calls).not.toContain('Upload upgrade archive');
    expect(calls).not.toContain('Activate remote release');
    expect(output.value).toContain('Dry run complete');
    expect(output.value).toContain('Archive:');
    expect(output.value).toContain('Target: server-alias:/tmp/aier-blog-code-20260815T120000Z.tar.gz');
  });

  it('clears progress before printing one final error report and stops later steps', async () => {
    const root = await mkdtemp(join(tmpdir(), 'upgrade-script-'));
    const output = new MemoryOutput();
    const events: string[] = [];
    const progress = {
      start: (_index: number, _total: number, label: string) => events.push(`progress:start:${label}`),
      succeed: (message: string) => events.push(`progress:succeed:${message}`),
      clear: () => events.push('progress:clear'),
    };
    const failure = new CommandFailure(
      'Check public site',
      'npm',
      ['run', 'check'],
      2,
      'useful diagnostic',
      join(root, 'failure.log'),
      false,
    );

    await expect(runUpgrade(
      { dryRun: false, sshHost: 'server-alias' },
      {
        root,
        release: '20260815T120000Z',
        platform: 'linux',
        output,
        errorOutput: output,
        progress,
        runCommand: async (options) => {
          events.push(`command:${options.step}`);
          throw failure;
        },
      },
    )).rejects.toBe(failure);

    events.push('error:Check public site');
    expect(events).toEqual([
      'progress:start:Check public site',
      'command:Check public site',
      'progress:clear',
      'error:Check public site',
    ]);
    expect(output.value).toContain('Upgrade failed');
    expect(output.value).toContain('Step: Check public site');
    expect(output.value).toContain('Exit code: 2');
    expect(output.value).toContain('useful diagnostic');
    expect(output.value.match(/Upgrade failed/g)).toHaveLength(1);
  });
});
