# Explicit Problem Code and Clip Watermark Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separate problem codes from titles in `problem` fences and give clip cards the requested watermark and non-glowing hover treatment.

**Architecture:** Extend the existing remark problem-card schema with a required `code` field and render that value directly as the decorative watermark. Keep the clip-card HTML unchanged and implement its watermark and hover treatment entirely in the shared stylesheet.

**Tech Stack:** Astro 7, TypeScript, Remark, CSS, Vitest

## Global Constraints

- Preserve all unrelated working-tree changes.
- Do not change other card types or add JavaScript.
- Use two-space indentation, single quotes in TypeScript, and semicolons.

---

### Task 1: Explicit problem code field

**Files:**
- Modify: `tests/remark-problem-card.test.ts`
- Modify: `src/lib/remark-problem-card.ts`
- Modify: `src/content/blog/BitDP.md`
- Modify: `src/content/blog/markdown-guide.md`

- [ ] Add tests proving `code: AT_DP_O` renders as the watermark while `title: Matching` remains the visible title, and that a missing code is rejected.
- [ ] Run the focused test and confirm it fails for the absent schema support.
- [ ] Add `code` to the allowed/required fields and remove title-prefix splitting.
- [ ] Update every `problem` fence to provide separate `code` and `title` values.
- [ ] Run the focused test and confirm it passes.

### Task 2: Clip watermark and hover

**Files:**
- Modify: `tests/clip-ui.test.ts`
- Modify: `src/styles/global.css`

- [ ] Add CSS contract assertions for a right-side `</>` watermark, light upward hover motion, stronger border, and ordinary shadow without a focus/hover glow ring.
- [ ] Run the focused test and confirm it fails.
- [ ] Replace the clip card's circular glow decoration with the watermark and align hover/focus shadow behavior with the requested treatment.
- [ ] Run the focused test and confirm it passes.

### Task 3: Verification

**Files:**
- Verify only

- [ ] Run `npm test -- --run`.
- [ ] Run `npm run check`.
- [ ] Run `npm run build`.
- [ ] Review the final diff to ensure unrelated changes were not overwritten.
