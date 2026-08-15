import { mkdir, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  CommandFailure,
  ProgressReporter,
  formatCommand,
  resolveExecutable,
  runCommand as runCapturedCommand,
  type RunCommandOptions,
} from './upgrade-runner';

export interface UpgradeOptions {
  dryRun: boolean;
  sshHost: string;
}

export interface UpgradeContext {
  root: string;
  release: string;
  platform: NodeJS.Platform;
  nodeExecutable?: string;
  npmCli?: string;
}

export interface UpgradeStep {
  label: string;
  file: string;
  args: readonly string[];
}

export interface UpgradePlan {
  release: string;
  archiveName: string;
  archivePath: string;
  remoteArchive: string;
  steps: readonly UpgradeStep[];
}

type OutputStream = NodeJS.WritableStream & { isTTY?: boolean };
type CommandRunner = (options: RunCommandOptions) => Promise<void>;
type Progress = Pick<ProgressReporter, 'start' | 'succeed' | 'clear'>;

export interface UpgradeDependencies {
  root?: string;
  release?: string;
  platform?: NodeJS.Platform;
  output?: OutputStream;
  errorOutput?: OutputStream;
  progress?: Progress;
  runCommand?: CommandRunner;
}

export interface UpgradeResult {
  release: string;
  archivePath: string;
  remoteArchive: string;
  dryRun: boolean;
}

export const archiveExclusions = [
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
] as const;

export function parseUpgradeArgs(args: readonly string[]): UpgradeOptions {
  const options: UpgradeOptions = {
    dryRun: false,
    sshHost: 'aliyun-aiopt',
  };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--dry-run' || argument === '-DryRun') {
      options.dryRun = true;
      continue;
    }
    if (argument === '--ssh-host' || argument === '-SshHost') {
      const value = args[index + 1];
      if (!value || value.startsWith('-')) {
        throw new Error(`Missing value for ${argument}`);
      }
      options.sshHost = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown option: ${argument}`);
  }

  return options;
}

function createRemoteScript(release: string, remoteArchive: string): string {
  return [
    'set -Eeuo pipefail',
    `release='${release}'`,
    `archive='${remoteArchive}'`,
    'new=/opt/aier-blog/releases/$release',
    'mkdir -p /opt/aier-blog/releases',
    'rm -rf -- "$new"',
    'mkdir -p -- "$new"',
    'tar -xzf "$archive" -C "$new"',
    'find "$new" -type d -exec chmod 0755 {} +',
    'find "$new" -type f -exec chmod 0644 {} +',
    'chmod 0755 "$new"/deployment/*.sh',
    'cd "$new"',
    'bash deployment/install-code.sh "$release" "$archive"',
  ].join('; ');
}

export function createUpgradePlan(
  options: UpgradeOptions,
  context: UpgradeContext,
): UpgradePlan {
  const archiveName = `aier-blog-code-${context.release}.tar.gz`;
  const archivePath = join(context.root, '.deploy', archiveName);
  const remoteArchive = `/tmp/${archiveName}`;
  const npmFile = context.platform === 'win32'
    ? context.nodeExecutable ?? process.execPath
    : resolveExecutable('npm', context.platform);
  const npmArgs = context.platform === 'win32'
    ? [context.npmCli ?? process.env.npm_execpath].filter((value): value is string => Boolean(value))
    : [];
  if (context.platform === 'win32' && npmArgs.length === 0) {
    throw new Error('Unable to locate npm-cli.js; run this command through npm run upgrade.');
  }
  const tar = resolveExecutable('tar', context.platform);
  const scp = resolveExecutable('scp', context.platform);
  const ssh = resolveExecutable('ssh', context.platform);
  const remoteScript = createRemoteScript(context.release, remoteArchive);
  const encodedRemoteScript = Buffer.from(remoteScript, 'utf8').toString('base64');

  const localSteps: UpgradeStep[] = [
    { label: 'Check public site', file: npmFile, args: [...npmArgs, 'run', 'check'] },
    { label: 'Check admin application', file: npmFile, args: [...npmArgs, 'run', 'admin:check'] },
    { label: 'Run tests', file: npmFile, args: [...npmArgs, 'test', '--', '--run'] },
    { label: 'Build admin client', file: npmFile, args: [...npmArgs, 'run', 'admin:build'] },
    { label: 'Validate content', file: npmFile, args: [...npmArgs, 'run', 'admin:validate-content'] },
    { label: 'Build public site', file: npmFile, args: [...npmArgs, 'run', 'build'] },
    {
      label: 'Create upgrade archive',
      file: tar,
      args: [
        '-czf',
        archivePath,
        ...archiveExclusions,
        '-C',
        context.root,
        '.',
      ],
    },
  ];

  const remoteSteps: UpgradeStep[] = [
    {
      label: 'Upload upgrade archive',
      file: scp,
      args: [archivePath, `${options.sshHost}:${remoteArchive}`],
    },
    {
      label: 'Activate remote release',
      file: ssh,
      args: [options.sshHost, `echo ${encodedRemoteScript} | base64 -d | bash`],
    },
  ];

  return {
    release: context.release,
    archiveName,
    archivePath,
    remoteArchive,
    steps: options.dryRun ? localSteps : [...localSteps, ...remoteSteps],
  };
}

function createRelease(now = new Date()): string {
  return now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function writeFailure(error: unknown, output: OutputStream): void {
  output.write('\nUpgrade failed\n');
  if (!(error instanceof CommandFailure)) {
    output.write(`${error instanceof Error ? error.message : String(error)}\n`);
    return;
  }

  output.write(`Step: ${error.step}\n`);
  output.write(`Command: ${formatCommand(error.file, error.args)}\n`);
  if (error.exitCode === null) {
    const cause = error.cause instanceof Error ? error.cause.message : 'Unable to start command';
    output.write(`Spawn error: ${cause}\n`);
  } else {
    output.write(`Exit code: ${error.exitCode}\n`);
  }
  if (error.outputTail) {
    output.write('\nCommand output:\n');
    output.write(`${error.outputTail}\n`);
  }
  output.write(`Full log: ${error.logPath}\n`);
}

export async function runUpgrade(
  options: UpgradeOptions,
  dependencies: UpgradeDependencies = {},
): Promise<UpgradeResult> {
  const root = dependencies.root ?? resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const release = dependencies.release ?? createRelease();
  const platform = dependencies.platform ?? process.platform;
  const output = dependencies.output ?? process.stdout;
  const errorOutput = dependencies.errorOutput ?? process.stderr;
  const progress = dependencies.progress ?? new ProgressReporter(output);
  const commandRunner = dependencies.runCommand ?? runCapturedCommand;
  const plan = createUpgradePlan(options, { root, release, platform });
  const deployDirectory = join(root, '.deploy');
  const logDirectory = join(deployDirectory, 'logs', `upgrade-${release}`);

  await mkdir(logDirectory, { recursive: true });
  await rm(plan.archivePath, { force: true });

  try {
    for (const [index, step] of plan.steps.entries()) {
      progress.start(index + 1, plan.steps.length, step.label);
      await commandRunner({
        ...step,
        step: step.label,
        cwd: root,
        logDirectory,
      });
    }

    await rm(logDirectory, { recursive: true, force: true });
    if (options.dryRun) {
      progress.succeed('Dry run complete');
      output.write(`Archive: ${plan.archivePath}\n`);
      output.write(`Target: ${options.sshHost}:${plan.remoteArchive}\n`);
    } else {
      progress.succeed(`System upgrade complete: ${release}`);
    }

    return {
      release,
      archivePath: plan.archivePath,
      remoteArchive: plan.remoteArchive,
      dryRun: options.dryRun,
    };
  } catch (error) {
    progress.clear();
    writeFailure(error, errorOutput);
    throw error;
  }
}

async function main(): Promise<void> {
  let options: UpgradeOptions;
  try {
    options = parseUpgradeArgs(process.argv.slice(2));
  } catch (error) {
    writeFailure(error, process.stderr);
    process.exitCode = 1;
    return;
  }

  try {
    await runUpgrade(options);
  } catch {
    process.exitCode = 1;
  }
}

const entryPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (entryPath === import.meta.url) {
  void main();
}
