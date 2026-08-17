# Publish Job Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent terminal SSE events from crashing the admin service and convert interrupted persisted publish jobs into explicit failures after restart.

**Architecture:** Make terminal status the final coordinator emission, make SSE shutdown idempotent, and reconcile persisted non-terminal jobs when publish routes are registered. Keep execution in memory and do not attempt unsafe automatic job replay.

**Tech Stack:** TypeScript, Fastify 5, Node.js SQLite, Vitest.

---

### Task 1: Make terminal coordinator events final

**Files:**
- Modify: `admin/server/publish/coordinator.ts`
- Test: `tests/admin-platform.test.ts`

- [ ] Add a regression test that subscribes to a successful job and asserts no event occurs after `succeeded`.
- [ ] Run the test and confirm it fails because the final `Published ...` log is emitted after the terminal status.
- [ ] Move the success log append before `setStatus(job, 'succeeded')`.
- [ ] Run the test and confirm it passes.

### Task 2: Make SSE completion idempotent

**Files:**
- Modify: `admin/server/routes/publish.ts`
- Test: `tests/admin-api-contract.test.ts`

- [ ] Add an HTTP-level regression test that observes a publish event stream through terminal completion without a server error.
- [ ] Run the test and confirm the current listener can write after ending.
- [ ] Add a guarded `close` helper that unsubscribes before ending and skips writes after `writableEnded` or `destroyed`.
- [ ] Run the regression test and confirm it passes.

### Task 3: Reconcile interrupted jobs on startup

**Files:**
- Modify: `admin/server/routes/publish.ts`
- Test: `tests/admin-api-contract.test.ts`

- [ ] Seed a persisted `queued` job before route registration and assert it becomes `failed` with an interruption log and `finishedAt`.
- [ ] Run the test and confirm it currently remains `queued`.
- [ ] Update non-terminal persisted rows during route registration, preserving existing logs.
- [ ] Run the regression test and confirm it passes.

### Task 4: Verify the repository

**Files:**
- No additional files.

- [ ] Run the targeted publish tests.
- [ ] Run `npm test -- --run`.
- [ ] Run `npm run check`.
- [ ] Run `npm run build`.
- [ ] Review `git diff` and confirm no unrelated user changes were overwritten.
