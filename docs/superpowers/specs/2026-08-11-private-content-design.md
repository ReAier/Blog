# Private Content Storage Design

## Goal

Keep `src/content/` and its `blog/`, `clips/`, and `images/` directories in Git while keeping all actual articles, code clips, and article images local-only. Restore the complete BitDP article and its clip sources before removing them from Git tracking.

## Repository Contract

Git tracks only these content placeholders:

```text
src/content/blog/.gitkeep
src/content/clips/.gitkeep
src/content/images/.gitkeep
```

`.gitignore` ignores every other file below those directories. `src/content.config.ts` remains tracked because it is application configuration, not authored content.

## Recovery

The authoritative recoverable version is commit `ac08558`, with the substantive content introduced by `3089e56`. Restore `BitDP.md` and its referenced clip files from that commit. Existing local articles, clips, and images remain on disk.

## Clean-clone Behavior

A clean clone contains empty content directories and must still pass checks, tests, and a static build. Tests must not require named private posts or private assets. Content-specific production assertions may run only when the corresponding local content and generated routes exist; parser and UI contracts remain covered by tracked source-level tests and public documentation examples.

## Documentation

README and maintenance/content/deployment documentation must explain that content is local-only, how to initialize the directories, how another deployer supplies a private content bundle, and that Git history still contains older content because history is not rewritten.

## Safety

Create an ignored backup before recovery. Use `git rm --cached`, never filesystem deletion, to stop tracking. After merging the commit, restore the backed-up private content into the main working tree and verify Git reports it as ignored.