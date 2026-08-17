# Upgrade Progress Accuracy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent `npm run upgrade` from displaying `100%` until every upgrade command has completed successfully.

**Architecture:** Keep progress reporting step-based and change only the TTY percentage calculation. The command orchestration and non-TTY logging remain unchanged; regression tests exercise the reporter contract directly.

**Tech Stack:** TypeScript, Node.js streams, Vitest.

## Global Constraints

- Preserve the existing `ProgressReporter` API and non-TTY output format.
- Use two-space indentation, single quotes, semicolons, and trailing commas in multiline structures.
- Do not modify unrelated existing working-tree changes.

---

### Task 1: Lock down progress semantics with regression tests

**Files:**
- Modify: `D:\Blog\tests\upgrade-runner.test.ts:133-173`

**Interfaces:**
- Consumes: `ProgressReporter.start(stepIndex, total, label)` and `ProgressReporter.succeed(message)`.
- Produces: failing expectations that define the first-step and final-step TTY percentages.

- [ ] **Step 1: Add a test that the first step starts at 0%**

Use the existing TTY writable helper and assert the first render contains `0%` rather than a percentage based on the current step index.

- [ ] **Step 2: Add a test that the final step starts below 100%**

Call `start(2, 2, 'Run tests')` on a TTY stream and assert the render contains `50%` and not `100%`.

- [ ] **Step 3: Run the focused tests and verify they fail**

Run:

```text
npm test -- --run tests/upgrade-runner.test.ts
```

Expected: the new percentage assertions fail because the current implementation renders `50%` for the first step and `100%` for the final step.

### Task 2: Fix TTY percentage calculation and verify the suite

**Files:**
- Modify: `D:\Blog\scripts\upgrade-runner.ts:125-146`
- Test: `D:\Blog\tests\upgrade-runner.test.ts:133-173`

**Interfaces:**
- Consumes: the existing `ProgressReporter` API.
- Produces: TTY progress renders based on completed steps, with `succeed()` rendering the completed `100%` state.

- [ ] **Step 1: Change the completed-step calculation**

Replace the TTY percentage calculation with:

```ts
const completedSteps = Math.max(0, Math.min(total, stepIndex - 1));
const percentage = Math.floor((completedSteps / total) * 100);
```

Use the percentage to build the existing 20-character bar.

- [ ] **Step 2: Run the focused tests and verify they pass**

Run:

```text
npm test -- --run tests/upgrade-runner.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run repository verification**

Run:

```text
npm test -- --run
npm run check
npm run build
```

Expected: all commands exit successfully.

- [ ] **Step 4: Review the diff**

Run:

```text
git diff -- D:\Blog\scripts\upgrade-runner.ts D:\Blog\tests\upgrade-runner.test.ts
```

Confirm only the progress calculation and its regression tests changed.
