# Admin Glass Surface Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reuse the existing admin header glass material across structural admin panels and make the sandboxed Markdown preview respond immediately to appearance changes.

**Architecture:** Treat the existing `.glass` class and current glass tokens as the single material primitive. Apply that primitive at component boundaries instead of duplicating CSS formulas, and synchronize iframe root datasets through a small preview helper plus the existing appearance-change signal.

**Tech Stack:** React, TypeScript, CSS, Vitest, Astro 7

## Global Constraints

- Reuse the existing glass implementation; do not create another material formula.
- Preserve unrelated uncommitted changes.
- Keep controls as controls rather than nested glass surfaces.
- Verify both dark and light appearance paths.

---

### Task 1: Lock down the visual contracts

**Files:**
- Modify: `tests/admin-client-visual.test.ts`
- Modify: `tests/admin-preview-regressions.test.ts`
- Inspect: `admin/client/src/pages/PostEditorPage.tsx`
- Inspect: `admin/client/src/pages/ClipEditorPage.tsx`

- [ ] Add assertions that all structural editor panels use the existing shared glass class.
- [ ] Add assertions rejecting standalone editor glass formulas where shared reuse is expected.
- [ ] Add preview tests for transparent document backgrounds and safe appearance datasets.
- [ ] Run targeted tests and confirm failures describe the missing contracts.

### Task 2: Reuse the glass surface across editor panels

**Files:**
- Modify: `admin/client/src/pages/PostEditorPage.tsx`
- Modify: `admin/client/src/pages/ClipEditorPage.tsx`
- Modify: `admin/client/src/styles.css`
- Modify: `admin/client/src/styles/theme.css` only if an existing token must be aliased rather than duplicated

- [ ] Add the existing `glass` class to post and clip structural panels.
- [ ] Remove or neutralize local background/blur/shadow rules that fight the shared material.
- [ ] Inspect other admin structural panels and apply the shared primitive where the same visual role exists.
- [ ] Run visual contract tests and keep responsive selectors intact.

### Task 3: Synchronize Markdown preview appearance

**Files:**
- Modify: `admin/client/src/lib/preview.ts`
- Modify: `admin/client/src/pages/PostEditorPage.tsx`
- Test: `tests/admin-preview-regressions.test.ts`

- [ ] Expose a safe helper for applying appearance datasets to preview HTML.
- [ ] Subscribe the post editor to the existing appearance-change mechanism so existing preview HTML updates without a new Markdown render request.
- [ ] Keep iframe body/page backgrounds transparent and remove its independent page background layer.
- [ ] Run preview regression tests.

### Task 4: Repository-wide consistency audit and verification

**Files:**
- Inspect: `admin/client/src/components/**/*.tsx`
- Inspect: `admin/client/src/pages/**/*.tsx`
- Inspect: `admin/client/src/styles.css`

- [ ] Find structural panels still using divergent material rules and convert only genuine panel surfaces to shared glass reuse.
- [ ] Run `npm test -- --run`.
- [ ] Run `npm run check`.
- [ ] Run `npm run build`.
- [ ] Review the resulting diff for accidental changes and document any intentionally excluded surfaces.
