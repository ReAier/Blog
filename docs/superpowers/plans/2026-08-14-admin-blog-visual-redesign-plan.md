# Admin Blog-Visual Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the admin presentation around the public blog's dark glass design, keep global navigation usable from editor routes, and make all text and controls clearly readable.

**Architecture:** `AppShell.tsx` owns a single high-stacking top navigation and responsive menu. `styles.css` exposes dark blog-derived design tokens and applies them consistently to existing page classes without changing server/API behavior. `MarkdownEditor.tsx` owns the CodeMirror dark theme so editor readability is not dependent on incidental global styles.

**Tech Stack:** React 19, React Router 7, TypeScript 6, Vite 7, CodeMirror 6, Vitest, Testing Library, CSS.

## Global Constraints

- Preserve all existing admin workflows and API contracts.
- Do not edit generated `admin/client/dist/`, `dist/`, `.astro/`, or deployment output by hand.
- Use two-space indentation, single quotes, semicolons, and trailing commas in multiline TypeScript.
- Match the public blog's plum background, dark glass surfaces, rose accent, serif display typography, sans-serif controls, and monospace technical metadata.
- Run `npm test -- --run` and `npm run build` before completion, plus admin-specific checks and browser regression.

---

### Task 1: Lock the shell and readability contracts

**Files:**
- Create: `tests/admin-client-visual.test.ts`
- Modify: `tests/admin-client-editor.test.ts`

- [ ] Add a shell contract asserting the global destinations are rendered inside a top navigation rather than a permanent sidebar.
- [ ] Add a regression contract asserting the header is above editor iframe/content stacking contexts and editor content cannot cover it.
- [ ] Add readability contracts for dark surface tokens, explicit form/placeholder colors, and CodeMirror foreground/gutter/selection styling.
- [ ] Run the focused tests and confirm they fail against the old shell/styles.

### Task 2: Replace the sidebar with blog-style top navigation

**Files:**
- Modify: `admin/client/src/components/AppShell.tsx`
- Modify: `admin/client/src/styles.css`

- [ ] Restructure the shell into a full-width workspace with a centered glass header.
- [ ] Keep the six `NavLink` destinations, active-route semantics, appearance controls, account label, and logout.
- [ ] Implement a contained responsive menu and route-change closing behavior.
- [ ] Add explicit stacking/isolation rules so the header remains clickable above editor panes and iframes.
- [ ] Run focused shell tests.

### Task 3: Introduce the shared dark glass design system

**Files:**
- Modify: `admin/client/src/styles.css`

- [ ] Replace pale default tokens with the public blog's dark neutral palette and background overlay.
- [ ] Normalize page headers, buttons, cards, toolbars, tables, filters, tags, status pills, dialogs, logs, backups, and empty states.
- [ ] Give inputs, selects, textareas, placeholders, disabled states, and secondary copy explicit readable colors.
- [ ] Preserve appearance/background choices while ensuring every choice has sufficient content-surface contrast.
- [ ] Add reduced-motion behavior and responsive navigation/content rules.
- [ ] Run focused visual contract tests.

### Task 4: Repair editor readability and interaction layering

**Files:**
- Modify: `admin/client/src/components/MarkdownEditor.tsx`
- Modify: `admin/client/src/styles.css`
- Test: `tests/admin-client-editor.test.ts`

- [ ] Add an explicit CodeMirror dark theme for text, caret, selection, gutters, active line, and matching brackets.
- [ ] Restyle article and clip metadata/source/preview panes as bounded dark surfaces.
- [ ] Ensure iframe and editor overflow stays inside the editor grid and below the global header.
- [ ] Verify save/history/resource dialogs and picker controls remain reachable.
- [ ] Run editor tests.

### Task 5: Verify behavior and visual fidelity

**Files:**
- Modify only if verification reveals a regression.

- [ ] Run `npm test -- --run`.
- [ ] Run `npm run admin:check`.
- [ ] Run `npm run admin:build`.
- [ ] Run `npm run build`.
- [ ] Start the admin locally and inspect dashboard, posts, open article, clips, open clip, images, backups, and publish pages.
- [ ] From an open article, click each global destination and verify the URL/page changes.
- [ ] Inspect desktop and mobile screenshots for contrast, clipping, overflow, and menu behavior.
- [ ] Review `git diff` and confirm no generated output or unrelated user changes were overwritten.
