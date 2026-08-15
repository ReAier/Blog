import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';

export type UpgradeExecutable = 'npm' | 'tar' | 'scp' | 'ssh';

type OutputStream = NodeJS.WritableStream & { isTTY?: boolean };

export function resolveExecutable(
  name: UpgradeExecutable,
  platform: NodeJS.Platform = process.platform,
): string {
  if (platform !== 'win32') return name;
  return name === 'npm' ? 'npm.cmd' : `${name}.exe`;
}

function quoteArgument(value: string): string {
  const abbreviated = value.length > 160
    ? `${value.slice(0, 120)}…${value.slice(-24)}`
    : value;
  return /^[A-Za-z0-9_./:@=-]+$/.test(abbreviated)
    ? abbreviated
    : `"${abbreviated.replaceAll('"', '\\"')}"`;
}

export function formatCommand(file: string, args: readonly string[]): string {
  return [file, ...args].map(quoteArgument).join(' ');
}

export interface RunCommandOptions {
  step: string;
  file: string;
  args: readonly string[];
  cwd: string;
  logDirectory: string;
  tailLimit?: number;
  output?: OutputStream;
}

export class CommandFailure extends Error {
  constructor(
    readonly step: string,
    readonly file: string,
    readonly args: readonly string[],
    readonly exitCode: number | null,
    readonly outputTail: string,
    readonly logPath: string,
    readonly hasMoreOutput: boolean,
    options?: ErrorOptions,
  ) {
    super(`${step} failed`, options);
    this.name = 'CommandFailure';
  }
}

function closeStream(stream: ReturnType<typeof createWriteStream>): Promise<void> {
  return new Promise((resolve, reject) => {
    stream.once('error', reject);
    stream.end(resolve);
  });
}

export async function runCommand(options: RunCommandOptions): Promise<void> {
  const tailLimit = options.tailLimit ?? 16_384;
  await mkdir(options.logDirectory, { recursive: true });
  const logPath = join(options.logDirectory, `${Date.now()}-${randomUUID()}.log`);
  const logStream = createWriteStream(logPath, { encoding: 'utf8' });
  let outputTail = '';
  let outputLength = 0;

  const capture = (chunk: Buffer): void => {
    const text = chunk.toString('utf8');
    outputLength += text.length;
    outputTail = `${outputTail}${text}`.slice(-tailLimit);
    logStream.write(chunk);
  };

  const result = await new Promise<{ exitCode: number | null; error?: Error }>((resolve) => {
    let child: ReturnType<typeof spawn>;
    try {
      child = spawn(options.file, [...options.args], {
        cwd: options.cwd,
        shell: false,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (error) {
      resolve({
        exitCode: null,
        error: error instanceof Error ? error : new Error(String(error)),
      });
      return;
    }
    let spawnError: Error | undefined;

    child.stdout!.on('data', capture);
    child.stderr!.on('data', capture);
    child.once('error', (error) => {
      spawnError = error;
    });
    child.once('close', (exitCode) => {
      resolve({ exitCode, error: spawnError });
    });
  });

  await closeStream(logStream);

  if (!result.error && result.exitCode === 0) {
    await rm(logPath, { force: true });
    return;
  }

  throw new CommandFailure(
    options.step,
    options.file,
    options.args,
    result.error ? null : result.exitCode,
    outputTail.trimEnd(),
    logPath,
    outputLength > outputTail.length,
    result.error ? { cause: result.error } : undefined,
  );
}

export class ProgressReporter {
  private active = false;

  constructor(private readonly output: OutputStream = process.stdout) {}

  start(stepIndex: number, total: number, label: string): void {
    if (!this.output.isTTY) {
      this.output.write(`[${stepIndex}/${total}] ${label}\n`);
      return;
    }

    this.active = true;
    const percentage = Math.floor((stepIndex / total) * 100);
    const completed = Math.floor((percentage / 100) * 20);
    const bar = `${'#'.repeat(completed)}${'-'.repeat(20 - completed)}`;
    this.output.write(`\r\x1b[2K[${bar}] ${percentage.toString().padStart(3)}% ${label}`);
  }

  succeed(message: string): void {
    if (this.output.isTTY) {
      this.output.write(`\r\x1b[2K[${'#'.repeat(20)}] 100% ${message}\n`);
      this.active = false;
      return;
    }

    this.output.write(`${message}\n`);
  }

  clear(): void {
    if (this.output.isTTY && this.active) {
      this.output.write('\r\x1b[2K');
      this.active = false;
    }
  }
}
