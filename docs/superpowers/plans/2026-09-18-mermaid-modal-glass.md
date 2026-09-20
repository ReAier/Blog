# Mermaid and Modal Glass Implementation Plan

**Goal:** Reuse the existing theme-aware frosted material for Mermaid figures and admin modal cards.
**Architecture:** Keep shared tokens in src/styles/glass-material.css. Change only consuming CSS and preview CSS assembly; preserve renderer and Dialog behavior.
**Tech Stack:** Astro, React, CSS, TypeScript, Vitest.

## Constraints
Preserve current uncommitted changes, diagram colors, geometry, theme switching, modal interactions and accessibility. No deployment or dependency changes.

## Task 1: Shared materials and preview support
- [x] Add tests/mermaid-modal-glass.test.ts for Mermaid surface, transparent SVG, prefixed filters, fallback, shared dialog shadow, and non-opacity scrim animation.
- [x] Add an actual preview-route integration test proving the shared glass tokens are embedded and the relative material import is replaced.
- [x] Run the new tests and confirm expected failures.
- [x] Update src/styles/global.css with shared Mermaid material and fallback; preserve all existing Mermaid rules.
- [x] Update admin/client/src/styles.css with a background-color scrim animation and shared shadow.
- [x] Update admin/server/routes/previews.ts to replace the shared material import with the contents of glass-material.css.
- [x] Run targeted tests, then the full suite, npm run admin:check, npm run build and npm run admin:build.
- [x] Review the change against the pre-task baseline. Attempt browser QA and disclose any unavailable verification. Do not stage or commit unrelated work.

## Verification results
- RED: 6 new regressions failed as expected (5 CSS contracts and 1 preview API integration test); 16 existing API tests passed.
- GREEN: 7 focused test files, 67 tests passed.
- Full suite: 91 test files, 546 tests passed.
- Site: npm run build passed, including Astro validation and 24 generated pages.
- Admin: TypeScript no-emit check and npm run admin:build passed.
- git diff --check passed (only repository line-ending conversion warnings).
- Browser visual QA unavailable: the browser tool returned "Codex auth token is unavailable". No screenshot-based approval is claimed.
- Changes are local and uncommitted; no production publishing or deployment performed.
