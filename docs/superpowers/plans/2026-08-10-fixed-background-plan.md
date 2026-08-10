# Cross-platform Fixed Background Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep static and WebGL backgrounds fixed to the viewport during iOS and Android touch scrolling.

**Architecture:** Render a dedicated fixed static background layer in the motion shell instead of relying on `body`'s fixed background attachment. Keep the WebGL canvas as a separate fixed layer and synchronize its backing size with `visualViewport` and window resize events.

**Tech Stack:** Astro 7, TypeScript, CSS, Vitest.

## Global Constraints

- Preserve existing desktop and Android visual appearance.
- Do not add dependencies.
- Do not edit generated `dist/`, `.astro/`, or `.deploy/` output.
- Run `npm run check`, `npm test -- --run`, and `npm run build` before completion.

---

### Task 1: Add regression tests for fixed background contracts

**Files:**
- Create: `tests/fixed-background.test.ts`
- Test: source contracts in `src/components/MotionShell.astro`, `src/styles/global.css`, and `src/scripts/fluid-background.ts`

- [ ] Write tests that require a dedicated fixed background element, forbid `background-attachment: fixed`, and require visual viewport synchronization hooks.
- [ ] Run `npm test -- --run tests/fixed-background.test.ts` and verify the new tests fail against the current implementation.

### Task 2: Move static background to a fixed layer

**Files:**
- Modify: `src/components/MotionShell.astro`
- Modify: `src/styles/global.css`

- [ ] Add the static background element to the motion shell before the canvas.
- [ ] Style it with full-viewport fixed positioning, stable compositing, and existing background image/overlay variables.
- [ ] Remove fixed attachment from the body while retaining the solid color fallback.
- [ ] Run the targeted tests and verify they pass.

### Task 3: Stabilize mobile WebGL viewport sizing

**Files:**
- Modify: `src/scripts/fluid-background.ts`

- [ ] Factor viewport resize handling so canvas size is recalculated from the current visual viewport when available.
- [ ] Register a passive visual viewport resize/scroll listener with the existing abort signal.
- [ ] Run targeted tests and type checks.

### Task 4: Full verification

**Files:**
- No additional files.

- [ ] Run `npm run check`.
- [ ] Run `npm test -- --run`.
- [ ] Run `npm run build`.
- [ ] Review the diff and confirm generated output is not part of the change.
