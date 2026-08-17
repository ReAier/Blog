# Admin List Filtering and Interaction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct article counts and rebuild article/Clip filtering and row interactions without changing the backend architecture or adding dependencies.

**Architecture:** Keep API resources separate for filtered display data and complete count data. Reuse the existing table and search primitives, adding narrowly scoped CSS for stacking, stretched row links, and route-focus suppression.

**Tech Stack:** React, React Router, TypeScript, CSS, Vitest.

## Global Constraints

- No new dependencies.
- Preserve keyboard navigation and semantic links/buttons.
- Search remains filename-only for Clips and title-only for articles.
- Generated directories are not edited.

---

### Task 1: Stable article counts

**Files:**
- Modify: `admin/client/src/pages/PostsPage.tsx`
- Test: `tests/admin-client-source.test.ts`

- [ ] Add a failing source contract proving counts derive from the complete article resource and mutations reload both resources.
- [ ] Run the focused test and confirm failure.
- [ ] Implement a named reload for the complete resource and calculate counts from it.
- [ ] Run the focused test and confirm success.

### Task 2: Filter stacking and search consistency

**Files:**
- Modify: `admin/client/src/pages/ClipsPage.tsx`
- Modify: `admin/client/src/styles.css`
- Test: `tests/admin-client-source.test.ts`

- [ ] Add failing contracts for shared search styling, rounded tag control, and elevated toolbar popovers.
- [ ] Run the focused test and confirm failure.
- [ ] Apply shared classes and scoped stacking CSS.
- [ ] Run the focused test and confirm success.

### Task 3: Full-row article and Clip lists

**Files:**
- Modify: `admin/client/src/pages/PostsPage.tsx`
- Modify: `admin/client/src/pages/ClipsPage.tsx`
- Modify: `admin/client/src/styles.css`
- Test: `tests/admin-client-source.test.ts`

- [ ] Add failing contracts for table-based Clips, stretched row links, and removal of visible edit copy.
- [ ] Run the focused test and confirm failure.
- [ ] Implement semantic table rows with independent action controls.
- [ ] Run the focused test and confirm success.

### Task 4: Programmatic route focus

**Files:**
- Modify: `admin/client/src/styles.css`
- Test: `tests/admin-client-source.test.ts`

- [ ] Add a failing contract for suppressing outline only on `main.content-canvas`.
- [ ] Run the focused test and confirm failure.
- [ ] Add the narrowly scoped focus rule.
- [ ] Run the focused test and confirm success.

### Task 5: Verification

- [ ] Run `npm test -- --run`.
- [ ] Run `npm run admin:check`.
- [ ] Run `npm run build`.
- [ ] Run `git diff --check`.
