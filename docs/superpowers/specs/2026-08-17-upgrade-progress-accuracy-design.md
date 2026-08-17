# Upgrade Progress Accuracy Design

**Date:** 2026-08-17

## Problem

`scripts/upgrade.ts` starts the progress reporter before each upgrade command. The current percentage uses the index of the step being started, so the final command is shown as `100%` before that command has completed.

## Decision

Use step-completion semantics for the TTY progress bar:

- Starting step `n` of `total` renders `(n - 1) / total` as the completed percentage.
- The final step therefore remains below `100%` while it is running.
- `succeed()` remains the only path that renders `100%`.
- Non-TTY output remains the existing `[n/total] label` line format.

## Verification

Add regression coverage in `tests/upgrade-runner.test.ts` for the first step, final step, final success output, and unchanged non-TTY output behavior. Run the focused test, the full Vitest suite, Astro/TypeScript checking, and the production build.
