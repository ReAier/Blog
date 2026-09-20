# Tag Article List Implementation Plan

**Goal:** Match tag detail article presentation to the all-posts list.

**Architecture:** Reuse PostListItem and ol.post-list directly in the tag route; preserve its data loading and metadata. No shared component or style changes.

**Tech Stack:** Astro, TypeScript, Vitest.

## Global Constraints

Preserve unrelated changes, filtering, sorting, headings and article counts. Leave homepage featured cards and tags index unchanged. No dependency updates or deployment.

### Task 1: Reuse article list on tag details

**Files:**
- Modify: src/pages/tags/[tag].astro
- Create: tests/tag-post-list.test.ts
- Modify: tests/post-cover-ui.test.ts (replace the obsolete tag-card expectation)

- [x] Add source-contract tests for shared list markup, retained tag behavior, and unchanged featured cards/tag index.
- [x] Run npm test -- --run tests/tag-post-list.test.ts and verify the list assertion fails on current card markup.
- [x] Replace PostCard import/rendering with PostListItem inside ol.post-list, matching src/pages/posts/index.astro.
- [x] Run focused tests and full npm test -- --run.
- [x] Run npm run build; inspect generated tag HTML for list rows, counts and absence of featured-card markup.
- [x] Review the scoped diff. Leave changes uncommitted for user review.

Validation: 92 test files / 550 tests passed; production build passed; all 6 generated tag detail pages have list markup and matching article counts. Scoped diff reviewed; no shared styles, filtering or other routes changed.
