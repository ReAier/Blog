# Clipboard Filter and Delete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Keep every clipboard language available after filtering and add a safe delete action to each clipboard card.

**Architecture:** Extend the clip-list response with a language facet computed before search/language filtering, then consume that facet in the React page. Restructure each card as an article containing a navigation link and a sibling delete button so interactive elements are not nested; reuse the existing delete endpoint and conflict rules.

**Tech Stack:** Astro 7, React 19, TypeScript, Fastify 5, Vitest, Testing Library, CSS.

---

## File map

- Modify `admin/server/routes/clips.ts`: attach sorted, unique `languages` to clip-list responses before applying filters.
- Modify `admin/client/src/types.ts`: add a typed clip-list response containing `languages`.
- Modify `admin/client/src/api/client.ts`: return the clip-specific list response type.
- Modify `admin/client/src/pages/ClipsPage.tsx`: use response facets and implement confirmed per-card deletion.
- Modify `admin/client/src/styles.css`: preserve card layout while separating navigation and delete controls.
- Modify `tests/admin-api-contract.test.ts`: cover language facets under active filtering.
- Create `tests/admin-client-clips.test.tsx`: cover persistent options and delete success/failure interaction.

### Task 1: Language facet regression

- [x] Add an API contract test that creates `cpp` and `typescript` clips, requests `/api/clips?language=cpp`, and expects only the C++ item plus `languages: ['cpp', 'typescript']`.
- [x] Run `npm test -- --run tests/admin-api-contract.test.ts` and verify the new assertion fails because `languages` is absent.
- [x] Add `ClipPageResult`, update `api.listClips`, and compute the full language facet before filtering in `registerClipRoutes`.
- [x] Re-run the targeted API contract test and verify it passes.

### Task 2: Clipboard list deletion interaction

- [x] Add jsdom tests that mock `api.listClips`/`api.deleteClip`, verify language options come from `data.languages`, verify cancel does not delete, verify confirmed deletion calls the API and reloads, and verify a rejected deletion shows the error.
- [x] Run `npm test -- --run tests/admin-client-clips.test.tsx` and verify failure because the page still derives options from filtered items and has no list delete control.
- [x] Update `ClipsPage` with `deletingSlug`, a confirmation-based delete handler, success/error notices, and article/link/button card markup.
- [x] Add focused card-link/delete-button CSS, hover/focus behavior, and disabled-state styling.
- [x] Re-run the client test and verify it passes.

### Task 3: Full verification

- [x] Run `npm test -- --run`.
- [x] Run `npm run check`.
- [x] Run `npm run admin:check`.
- [x] Run `npm run build`.
- [x] Inspect the diff to confirm only intended clipboard, test, type, style, and design/plan files changed; do not commit because the shared feature branch already contains unrelated uncommitted work.
