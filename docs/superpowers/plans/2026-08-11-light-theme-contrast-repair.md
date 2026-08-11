# Light Theme Contrast Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair light-mode code readability and increase all content-card watermark contrast with theme-aware values.

**Architecture:** Centralize Shiki themes in one TypeScript module consumed by Astro configuration and clip rendering. Centralize decorative watermark opacity in CSS custom properties and apply the token to clip, reference, and problem card marks.

**Tech Stack:** Astro 7, Shiki, TypeScript, CSS custom properties, Vitest

## Task 1: Lock the contrast contracts

- [ ] Add a test requiring shared `github-light`/`github-dark` themes and `defaultColor: false`.
- [ ] Require both `astro.config.ts` and `src/lib/clip-highlight.ts` to consume the shared config.
- [ ] Require CSS light/dark Shiki variables and `.15`/`.09` watermark tokens.
- [ ] Require clip, reference, and problem watermarks to use the shared token.
- [ ] Run the focused test and confirm it fails for the missing feature.

## Task 2: Implement shared syntax themes

- [ ] Create `src/lib/syntax-highlighting.ts` exporting the approved Shiki configuration.
- [ ] Add it to the Astro Markdown configuration.
- [ ] Add it to the clip Markdown processor.
- [ ] Add theme-scoped Shiki color rules to `src/styles/global.css`.
- [ ] Run the focused test and static check.

## Task 3: Implement adaptive watermark contrast

- [ ] Add light and dark watermark opacity tokens.
- [ ] Apply the token to `.clip-card::after`, `.reference-card::after`, and `.problem-card__watermark`.
- [ ] Add approved mobile theme values.
- [ ] Run focused UI tests.

## Task 4: Verify and integrate

- [ ] Run `npm run check`.
- [ ] Run `npm test -- --run`.
- [ ] Run `npm run build`.
- [ ] Confirm generated article code contains both `--shiki-light` and `--shiki-dark`.
- [ ] Confirm the working tree is clean after commits.
- [ ] Merge the branch into `main` and repeat the full verification.
