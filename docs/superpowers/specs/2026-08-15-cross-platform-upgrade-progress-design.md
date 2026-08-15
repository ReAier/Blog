# Cross-platform upgrade progress design

## Goal

Replace the PowerShell-only `npm run upgrade` entry point with a Node.js/TypeScript command that works consistently on Windows, macOS, and Linux. Normal command output stays quiet behind a concise progress display. If a step fails, the command clears the progress UI and prints the useful captured diagnostics once, at the end.

## Command interface

- `npm run upgrade` runs `tsx scripts/upgrade.ts`.
- Existing options remain available in cross-platform form:
  - `npm run upgrade -- --dry-run`
  - `npm run upgrade -- --ssh-host <host>`
- For transition convenience, the parser may also accept PowerShell-style `-DryRun` and `-SshHost`, but documentation uses lowercase long options.
- The default SSH host remains `aliyun-aiopt`.

## Progress experience

The script models the upgrade as nine named steps:

1. Check public site
2. Check admin application
3. Run tests
4. Build admin client
5. Validate content
6. Build public site
7. Create upgrade archive
8. Upload upgrade archive
9. Activate remote release

In an interactive TTY, the current step is rendered on one updating terminal line with a spinner, a fixed-width progress bar, percentage, and step label. Completed steps do not leave command logs behind. In a non-interactive terminal or redirected log, the script prints one short line per step instead of emitting ANSI cursor-control sequences.

A dry run completes after archive creation and reports the local archive path and intended remote target. A real run reports the activated release identifier.

## Process execution and log capture

Each external command is launched with Node's `child_process.spawn` using argument arrays and `shell: false`. This avoids platform-specific shell quoting and command injection problems.

Executable resolution is platform-aware:

- npm: `npm.cmd` on Windows, `npm` elsewhere
- tar: `tar.exe` on Windows, `tar` elsewhere
- scp: `scp.exe` on Windows, `scp` elsewhere
- ssh: `ssh.exe` on Windows, `ssh` elsewhere

Standard output and standard error are captured rather than inherited. To avoid unbounded memory usage, output is written to a temporary per-run log file while a bounded tail is retained for the final failure report. Temporary logs are removed after success. On failure, the full log path is retained and shown so diagnostics are not lost.

## Error behavior

The top-level runner catches all failures. It first closes or clears the progress display, then prints a single error section containing:

- failed step name
- executable and safely formatted arguments
- exit code or spawn error
- captured output tail
- full temporary log path when additional output exists

The process exits non-zero. Later steps are not run. Secrets are not expected in the current arguments; command formatting is centralized so sensitive arguments can be redacted in the future.

## Archive behavior

The TypeScript implementation preserves the current archive name, UTC release identifier, exclusion list, remote archive location, and remote activation script. Paths are constructed with Node's path APIs. Arguments are passed directly to `tar`, so spaces in local paths remain safe across supported operating systems.

## Code organization

- `scripts/upgrade.ts`: CLI parsing, step definitions, archive/deployment orchestration, and top-level error presentation.
- `scripts/upgrade-runner.ts`: testable process runner, progress renderer, platform command resolution, bounded log handling, and error types.
- `tests/upgrade-runner.test.ts`: unit tests using the current Node process as a fake child command; no SSH connection or production deployment.
- `tests/upgrade-script.test.ts`: source/contract tests for the command entry point, preserved exclusions, dry-run cutoff, and package script.
- `scripts/upgrade.ps1`: removed after the Node entry point is covered.

## Test strategy

Tests cover:

- platform-specific executable names
- interactive progress rendering and non-TTY fallback
- successful child output being hidden
- stdout and stderr capture
- bounded error-tail behavior
- non-zero exits and spawn failures
- progress cleanup before error output
- argument parsing for dry-run and SSH host
- dry run not executing upload or activation
- preserved archive exclusions and remote release flow

Verification runs `npm test -- --run`, `npm run check`, and a safe CLI smoke test that cannot upload or switch remote code. The production `npm run upgrade` command is not run without `--dry-run` during verification.

## Compatibility and constraints

Node.js remains the only project runtime dependency. The implementation uses no progress-bar package; the small renderer uses ANSI only when `stdout.isTTY` is true. The external `tar`, `ssh`, and `scp` programs must still be installed, matching the current deployment requirements. Missing executables produce the same final structured error report rather than raw Node stack traces.
