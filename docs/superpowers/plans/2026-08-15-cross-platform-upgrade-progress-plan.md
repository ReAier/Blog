# Cross-platform Upgrade Progress Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the PowerShell-only upgrade command with a cross-platform Node.js/TypeScript CLI that shows concise progress, suppresses successful child-process logs, and prints captured diagnostics only after failure.

**Architecture:** A reusable runner module owns platform executable resolution, child-process capture, temporary logs, bounded diagnostic tails, and TTY/non-TTY progress rendering. A thin upgrade CLI parses arguments, defines the nine deployment steps, preserves the existing archive and remote activation behavior, and formats one final success or failure summary.

**Tech Stack:** Node.js 24, TypeScript 6, `tsx`, Node `child_process`/`fs`/`path`/`os` APIs, Vitest 4.

## Global Constraints

- Support Windows, macOS, and Linux from the same `npm run upgrade` command.
- Add no third-party progress-bar dependency.
- Use `spawn` with argument arrays and `shell: false` for all external commands.
- Preserve the existing UTC release ID, archive name, exclusions, remote path, permissions normalization, and install script invocation.
- Interactive output uses one updating progress line; non-TTY output uses one short line per step.
- Successful child output is hidden; failed child output is printed once after progress cleanup.
- `--dry-run` must never invoke `scp` or `ssh`.
- Never execute a real deployment as part of automated verification.

## File Map

- Create `scripts/upgrade-runner.ts`: command resolution, progress rendering, process execution, temporary log capture, bounded tails, and typed failures.
- Create `scripts/upgrade.ts`: CLI parsing, deployment step orchestration, archive construction, remote script construction, and final summaries.
- Create `tests/upgrade-runner.test.ts`: behavioral tests for progress and child-process capture.
- Create `tests/upgrade-script.test.ts`: CLI parsing and deployment contract tests.
- Modify `tests/admin-deployment-scripts.test.ts`: point existing archive and package-script contracts at the TypeScript entry point.
- Modify `package.json`: run `tsx scripts/upgrade.ts`.
- Delete `scripts/upgrade.ps1`: remove the platform-specific entry point after parity tests pass.
- Modify `README.md`: document cross-platform syntax and quiet/error behavior.

---

### Task 1: Cross-platform runner and quiet child-process capture

**Files:**
- Create: `tests/upgrade-runner.test.ts`
- Create: `scripts/upgrade-runner.ts`

**Interfaces:**
- Produces: `resolveExecutable(name: 'npm' | 'tar' | 'scp' | 'ssh', platform?: NodeJS.Platform): string`
- Produces: `formatCommand(file: string, args: readonly string[]): string`
- Produces: `CommandFailure extends Error` with `step`, `file`, `args`, `exitCode`, `outputTail`, `logPath`, and `hasMoreOutput`.
- Produces: `runCommand(options: RunCommandOptions): Promise<void>`.
- Produces: `ProgressReporter` with `start(stepIndex, total, label)`, `succeed()`, and `clear()`.

- [ ] **Step 1: Write failing executable-resolution and formatting tests**

```ts
import { describe, expect, it } from 'vitest';
import { formatCommand, resolveExecutable } from '../scripts/upgrade-runner';

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
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npx vitest --configLoader runner tests/upgrade-runner.test.ts --run`

Expected: FAIL because `scripts/upgrade-runner.ts` does not exist.

- [ ] **Step 3: Implement executable resolution, diagnostic formatting, and typed options**

```ts
export type UpgradeExecutable = 'npm' | 'tar' | 'scp' | 'ssh';

export function resolveExecutable(
  name: UpgradeExecutable,
  platform: NodeJS.Platform = process.platform,
): string {
  if (platform !== 'win32') return name;
  return name === 'npm' ? 'npm.cmd' : `${name}.exe`;
}

function quoteArgument(value: string): string {
  return /^[A-Za-z0-9_./:@=-]+$/.test(value)
    ? value
    : `"${value.replaceAll('"', '\\"')}"`;
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
}
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npx vitest --configLoader runner tests/upgrade-runner.test.ts --run`

Expected: PASS for executable resolution and formatting.

- [ ] **Step 5: Add failing tests for hidden success output and retained failure diagnostics**

```ts
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CommandFailure, runCommand } from '../scripts/upgrade-runner';

it('does not write successful child output to the parent streams', async () => {
  const logs = await mkdtemp(join(tmpdir(), 'upgrade-runner-'));
  await expect(runCommand({
    step: 'fake success',
    file: process.execPath,
    args: ['-e', 'console.log("hidden output")'],
    cwd: process.cwd(),
    logDirectory: logs,
  })).resolves.toBeUndefined();
});

it('captures a bounded tail and keeps the full log after failure', async () => {
  const logs = await mkdtemp(join(tmpdir(), 'upgrade-runner-'));
  const failure = await runCommand({
    step: 'fake failure',
    file: process.execPath,
    args: ['-e', 'console.error("diagnostic marker"); process.exit(7)'],
    cwd: process.cwd(),
    logDirectory: logs,
    tailLimit: 1024,
  }).catch((error: unknown) => error);

  expect(failure).toBeInstanceOf(CommandFailure);
  expect(failure).toMatchObject({ step: 'fake failure', exitCode: 7 });
  expect((failure as CommandFailure).outputTail).toContain('diagnostic marker');
  await expect(readFile((failure as CommandFailure).logPath, 'utf8'))
    .resolves.toContain('diagnostic marker');
});
```

- [ ] **Step 6: Run the focused test and verify RED**

Run: `npx vitest --configLoader runner tests/upgrade-runner.test.ts --run`

Expected: FAIL because `runCommand` and `CommandFailure` are not implemented.

- [ ] **Step 7: Implement file-backed capture and bounded tails**

Use `spawn(file, [...args], { cwd, shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })`. Pipe both output streams into a uniquely named file under `logDirectory`, track only the last `tailLimit ?? 16_384` UTF-8 characters in memory, remove the log on exit code `0`, and reject with `CommandFailure` on a non-zero exit or `error` event. Wait for the log stream to finish before resolving or rejecting.

```ts
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
```

- [ ] **Step 8: Run the focused test and verify GREEN**

Run: `npx vitest --configLoader runner tests/upgrade-runner.test.ts --run`

Expected: PASS, including exit code `7`, captured marker, and readable retained log.

- [ ] **Step 9: Add failing progress-renderer tests**

Create an in-memory writable stream with an assignable `isTTY` property. Assert that TTY mode contains a bar, percentage, and `\r`, while non-TTY mode emits exactly one line when each step starts and no ANSI escape sequences.

```ts
expect(ttyOutput).toContain('[####');
expect(ttyOutput).toContain('50%');
expect(ttyOutput).toContain('\r');
expect(logOutput.trim().split('\n')).toEqual([
  '[1/2] Check public site',
  '[2/2] Run tests',
]);
```

- [ ] **Step 10: Run the focused test and verify RED**

Run: `npx vitest --configLoader runner tests/upgrade-runner.test.ts --run`

Expected: FAIL because `ProgressReporter` does not exist.

- [ ] **Step 11: Implement deterministic TTY and non-TTY progress output**

`ProgressReporter.start()` calculates `Math.floor((stepIndex / total) * 100)`, renders a 20-character bar in TTY mode, and prints `[index/total] label` once in non-TTY mode. `succeed()` renders 100% and a newline only at the end of the whole run. `clear()` removes the active TTY line with `\r\x1b[2K` and is a no-op for non-TTY output. Keep animation optional and injectable so tests do not use timers.

- [ ] **Step 12: Run the focused test and verify GREEN**

Run: `npx vitest --configLoader runner tests/upgrade-runner.test.ts --run`

Expected: all runner tests PASS.

- [ ] **Step 13: Commit the runner slice**

```powershell
git add scripts/upgrade-runner.ts tests/upgrade-runner.test.ts
git commit -m "feat: add quiet cross-platform upgrade runner"
```

---

### Task 2: Upgrade CLI argument parsing and step orchestration

**Files:**
- Create: `tests/upgrade-script.test.ts`
- Create: `scripts/upgrade.ts`

**Interfaces:**
- Consumes: `runCommand`, `resolveExecutable`, `ProgressReporter`, `CommandFailure`, and `formatCommand` from `scripts/upgrade-runner.ts`.
- Produces: `parseUpgradeArgs(args: readonly string[]): UpgradeOptions`.
- Produces: `createUpgradePlan(options: UpgradeOptions, context: UpgradeContext): UpgradePlan`.
- Produces: `runUpgrade(options: UpgradeOptions, dependencies?: UpgradeDependencies): Promise<UpgradeResult>`.

- [ ] **Step 1: Write failing CLI parser tests**

```ts
import { describe, expect, it } from 'vitest';
import { parseUpgradeArgs } from '../scripts/upgrade';

describe('upgrade CLI arguments', () => {
  it('uses safe defaults', () => {
    expect(parseUpgradeArgs([])).toEqual({ dryRun: false, sshHost: 'aliyun-aiopt' });
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
});
```

- [ ] **Step 2: Run parser tests and verify RED**

Run: `npx vitest --configLoader runner tests/upgrade-script.test.ts --run`

Expected: FAIL because `scripts/upgrade.ts` does not exist.

- [ ] **Step 3: Implement minimal argument parsing without starting the CLI during import**

Export `parseUpgradeArgs`. Guard the executable entry point with an ESM main-module check based on `pathToFileURL(process.argv[1]).href === import.meta.url`, so Vitest can import the module safely.

- [ ] **Step 4: Run parser tests and verify GREEN**

Run: `npx vitest --configLoader runner tests/upgrade-script.test.ts --run`

Expected: parser tests PASS.

- [ ] **Step 5: Add failing plan-contract tests**

Use a fixed release ID `20260815T120000Z` and root `C:\\project` or `/project` through injected context. Assert:

```ts
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
expect(dryRunPlan.steps.map((step) => step.label)).not.toContain('Upload upgrade archive');
expect(tarArgs).toEqual(expect.arrayContaining([
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
expect(remoteScript).toContain('find "$new" -type d -exec chmod 0755 {} +');
expect(remoteScript).toContain('find "$new" -type f -exec chmod 0644 {} +');
expect(remoteScript).toContain('chmod 0755 "$new"/deployment/*.sh');
```

- [ ] **Step 6: Run contract tests and verify RED**

Run: `npx vitest --configLoader runner tests/upgrade-script.test.ts --run`

Expected: FAIL because deployment planning is not implemented.

- [ ] **Step 7: Implement the immutable deployment plan**

Define `UpgradeStep` as `{ label: string; file: string; args: readonly string[] }`. Construct npm steps with resolved npm executable and explicit arguments. Construct tar arguments exactly once in an exported `archiveExclusions` constant. Build the remote script from the fixed release and archive path, UTF-8 encode it with `Buffer.from(remoteScript).toString('base64')`, and pass `echo <encoded> | base64 -d | bash` as one remote SSH argument. Omit steps 8 and 9 from dry-run plans.

- [ ] **Step 8: Run contract tests and verify GREEN**

Run: `npx vitest --configLoader runner tests/upgrade-script.test.ts --run`

Expected: parser and deployment-plan tests PASS.

- [ ] **Step 9: Add failing orchestration tests with injected dependencies**

Inject a fake `runCommand` that records step labels, a fixed clock, temporary root, and memory output. Verify all steps run in order on success; dry-run stops after archive creation; the first failure prevents later calls; and final failure formatting occurs only after `progress.clear()`.

```ts
expect(calls).toEqual(plan.steps.map((step) => step.label));
expect(events).toEqual([
  'progress:start:Check public site',
  'command:Check public site',
  'progress:clear',
  'error:Check public site',
]);
```

- [ ] **Step 10: Run orchestration tests and verify RED**

Run: `npx vitest --configLoader runner tests/upgrade-script.test.ts --run`

Expected: FAIL because `runUpgrade` and final reporting are not implemented.

- [ ] **Step 11: Implement upgrade orchestration and final summaries**

Create `.deploy` and a per-run temporary log directory before executing commands. For each plan step, call `progress.start(index + 1, total, label)` then `runCommand`. On dry-run success print only `Dry run complete`, `Archive: <path>`, and `Target: <host>:<remote path>`. On real success print `System upgrade complete: <release>`. On failure clear progress, print a heading `Upgrade failed`, step, formatted command, exit/spawn detail, output tail, and retained log path when present, then set `process.exitCode = 1` only in the executable entry point.

- [ ] **Step 12: Run orchestration tests and verify GREEN**

Run: `npx vitest --configLoader runner tests/upgrade-script.test.ts --run`

Expected: all upgrade-script tests PASS.

- [ ] **Step 13: Commit the CLI slice**

```powershell
git add scripts/upgrade.ts tests/upgrade-script.test.ts
git commit -m "feat: add cross-platform upgrade CLI"
```

---

### Task 3: Switch the npm entry point and migrate deployment contracts

**Files:**
- Modify: `package.json`
- Modify: `tests/admin-deployment-scripts.test.ts`
- Delete: `scripts/upgrade.ps1`

**Interfaces:**
- Consumes: executable CLI at `scripts/upgrade.ts`.
- Produces: stable `npm run upgrade -- --dry-run` command surface.

- [ ] **Step 1: Update existing contract tests first**

Change the expected package script to:

```ts
expect(packageJson.scripts.upgrade).toBe('tsx scripts/upgrade.ts');
```

Read `scripts/upgrade.ts` instead of `scripts/upgrade.ps1` in archive exclusion and permission-normalization tests. Add assertions that the PowerShell script is absent and the TypeScript script contains no `shell: true`.

- [ ] **Step 2: Run existing deployment tests and verify RED**

Run: `npx vitest --configLoader runner tests/admin-deployment-scripts.test.ts --run`

Expected: FAIL because `package.json` still points at PowerShell and the old script still exists.

- [ ] **Step 3: Switch the package script and remove PowerShell**

Set:

```json
"upgrade": "tsx scripts/upgrade.ts"
```

Delete `scripts/upgrade.ps1`. Do not change the lockfile because `tsx` is already installed.

- [ ] **Step 4: Run deployment and upgrade tests and verify GREEN**

Run: `npx vitest --configLoader runner tests/admin-deployment-scripts.test.ts tests/upgrade-runner.test.ts tests/upgrade-script.test.ts --run`

Expected: all selected tests PASS.

- [ ] **Step 5: Run TypeScript/Astro validation**

Run: `npm run check`

Expected: exit code `0` with no TypeScript or Astro errors.

- [ ] **Step 6: Commit the entry-point migration**

```powershell
git add package.json tests/admin-deployment-scripts.test.ts scripts/upgrade.ps1
git commit -m "refactor: migrate upgrade command to Node.js"
```

---

### Task 4: Documentation and safe end-to-end verification

**Files:**
- Modify: `README.md`
- Test: `tests/upgrade-runner.test.ts`
- Test: `tests/upgrade-script.test.ts`
- Test: `tests/admin-deployment-scripts.test.ts`

**Interfaces:**
- Consumes: final `npm run upgrade` CLI.
- Produces: documented cross-platform invocation and verified release behavior.

- [ ] **Step 1: Document the cross-platform command**

Add a maintenance section showing:

```text
npm run upgrade -- --dry-run
npm run upgrade -- --ssh-host aliyun-aiopt
```

State that Windows, macOS, and Linux are supported; normal subprocess logs are hidden; failure diagnostics and the retained full-log path are printed at the end; and `tar`, `ssh`, and `scp` must be available on `PATH`.

- [ ] **Step 2: Run the focused test suite**

Run: `npx vitest --configLoader runner tests/upgrade-runner.test.ts tests/upgrade-script.test.ts tests/admin-deployment-scripts.test.ts --run`

Expected: all selected tests PASS.

- [ ] **Step 3: Run the full test suite**

Run: `npm test -- --run`

Expected: exit code `0`, no failed test files, no failed tests.

- [ ] **Step 4: Run the production build**

Run: `npm run build`

Expected: exit code `0` and generated static output in `dist/`.

- [ ] **Step 5: Run a non-deploying CLI smoke test through injected/fake commands**

Do not run the real `npm run upgrade -- --dry-run`, because it intentionally performs the full checks, tests, builds, and archive creation and may be unnecessarily expensive after the same commands have already been verified. Instead, run the CLI integration test that injects fake commands:

Run: `npx vitest --configLoader runner tests/upgrade-script.test.ts --run -t "runs a dry upgrade without upload or activation"`

Expected: PASS and recorded steps end at `Create upgrade archive` with no `scp` or `ssh` call.

- [ ] **Step 6: Inspect the final diff for accidental deployment changes**

Run: `git diff -- scripts/upgrade-runner.ts scripts/upgrade.ts scripts/upgrade.ps1 tests/upgrade-runner.test.ts tests/upgrade-script.test.ts tests/admin-deployment-scripts.test.ts package.json README.md`

Expected: only the cross-platform runner, CLI migration, tests, and documentation changed; remote directories and activation semantics match the former PowerShell script.

- [ ] **Step 7: Commit documentation and verification updates**

```powershell
git add README.md
git commit -m "docs: document cross-platform system upgrades"
```
