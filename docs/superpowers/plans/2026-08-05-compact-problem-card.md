# Compact Problem Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign embedded problem cards as compact Online Judge entries with explicit difficulty, platform, problem-code, category, and lightweight action hierarchy.

**Architecture:** Keep the existing Markdown directive and remark transform, enriching only its generated semantic HTML. Restyle the existing `problem-card` class family in global CSS and protect the output contract with Vitest assertions.

**Tech Stack:** Astro 7, TypeScript, remark HTML output, CSS, Vitest

## Global Constraints

- Preserve the existing `problem` Markdown fields and URL validation.
- Add no runtime dependency or browser JavaScript.
- Preserve keyboard focus and reduced-motion behavior.
- Do not modify unrelated working-tree changes.

---

### Task 1: Define the new markup contract

**Files:**
- Modify: `tests/remark-problem-card.test.ts`
- Modify: `tests/problem-ui.test.ts`

- [ ] Add assertions for a visible difficulty label, inferred platform, separated problem code, category tags, and the lightweight action copy.
- [ ] Add CSS contract assertions that reject the old corner triangle and require the new compact grid/difficulty marker.
- [ ] Run `npm test -- --run tests/remark-problem-card.test.ts tests/problem-ui.test.ts` and confirm the new assertions fail.

### Task 2: Implement semantic card markup

**Files:**
- Modify: `src/lib/remark-problem-card.ts`

- [ ] Add small pure helpers to split a leading problem code and infer the platform label from the validated URL.
- [ ] Render the compact header, code/title group, categories, platform link, and lightweight action while preserving escaping and link security attributes.
- [ ] Run the focused tests and confirm the markup assertions pass while style assertions remain actionable.

### Task 3: Implement compact responsive styling

**Files:**
- Modify: `src/styles/global.css`

- [ ] Replace the corner triangle with a difficulty-colored marker and restrained glow.
- [ ] Use a compact two-column layout on desktop and a single-column layout below 560px.
- [ ] Style the problem code, title, tags, platform link, and action with the existing typography and motion variables.
- [ ] Run the focused tests until all pass.

### Task 4: Verify production behavior

**Files:**
- Verify only

- [ ] Run `npm test -- --run`.
- [ ] Run `npm run check`.
- [ ] Run `npm run build`.
- [ ] Inspect the final diff to confirm only intended problem-card files and planning documents changed.
