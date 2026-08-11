# Private Content Storage Implementation Plan

**Goal:** Restore the full local article set, keep authored content outside Git, and preserve clean-clone build/test behavior.

**Architecture:** Git retains only `.gitkeep` placeholders under `src/content/`. Actual content is ignored and supplied locally. Tests use tracked documentation and conditional production assertions rather than fixed private filenames.

**Tech Stack:** Astro 7, TypeScript, Vitest, Git.

## Tasks

1. Add a failing repository-policy test asserting ignore rules, placeholder files, and absence of hard-coded private content dependencies.
2. Add `.gitignore` rules and `.gitkeep` placeholders; stop tracking authored content with `git rm --cached` while retaining working-tree files.
3. Restore `BitDP.md` and its referenced clips from `ac08558` into the ignored working tree.
4. Refactor content-dependent tests to use tracked documentation or optional generated routes, then verify the policy test passes.
5. Update README and maintenance/content/deployment documentation for local-only content and private deployment bundles.
6. Verify both the populated working tree and a fresh worktree containing only tracked placeholders.
7. Commit, merge to `main`, restore the private content backup into the main working tree, and re-run checks.