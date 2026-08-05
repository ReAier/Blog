# Unified Content Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove redundant article-card actions, unify theme-colored card border feedback, and align the clip detail page with the article code-block glass treatment.

**Architecture:** Keep the existing remark renderers and card-specific DOM structures, changing only emitted links/actions and shared CSS states. Preserve the shared clip copy enhancer for the detail page, remove the standalone back enhancer, and reuse the existing `--code-surface`/backdrop-filter language for the clip code shell.

**Tech Stack:** Astro 7, TypeScript, remark HTML renderers, CSS, Vitest.

## Global Constraints

- Do not redesign the internal layout of the four card types.
- Do not make problem, clip, or reference cards wholly clickable.
- Keep problem difficulty colors on the left rail, glow, and watermark; use the site accent for the outer border.
- Keep the callout card's native `details`/`summary` structure and behavior unchanged.
- Keep copy and download actions on the clip detail page.
- Open clip title links in a new tab with `target="_blank"` and `rel="noopener noreferrer"`.
- Preserve unrelated uncommitted workspace changes; do not commit or rewrite files outside this feature's exact scope.

---

### Task 1: Lock the article-card markup contracts

**Files:**
- Modify: `tests/clip-ui.test.ts`
- Modify: `tests/reference-ui.test.ts`
- Modify: `src/lib/remark-clip-card.ts`
- Modify: `src/lib/remark-reference-card.ts`

**Interfaces:**
- Consumes: existing `renderClipCard(clip: ClipRecord): string` and `renderReferenceCard(fields: ReferenceCardFields): string` HTML generation.
- Produces: metadata-only clip cards with a new-tab title link and reference cards without a duplicate action link.

- [ ] **Step 1: Update tests to require the simplified card markup**

Change the clip UI contract to assert that the remark renderer:

- contains `target="_blank"` and `rel="noopener noreferrer"` on the clip title link;
- contains an external-open indicator;
- does not contain `clip-card__actions`, `data-copy-clip`, or `clip.rawUrl`;
- still emits `data-clip-card` and does not embed `clip.code`.

Change the reference UI contract to assert that the renderer does not emit `reference-card__action` or the “访问原文” CTA while retaining the title link's new-tab attributes.

- [ ] **Step 2: Run focused tests and verify they fail**

Run:

```powershell
npm test -- --run tests/clip-ui.test.ts tests/reference-ui.test.ts
```

Expected: failures against the old clip actions, old reference CTA, and missing new-tab clip-title contract.

- [ ] **Step 3: Simplify the clip and reference renderers**

In `src/lib/remark-clip-card.ts`:

- remove the `.clip-card__actions` block, copy button, raw URL data, and status node;
- render the title anchor with `target="_blank" rel="noopener noreferrer"`;
- add a small `aria-hidden="true"` external-open indicator inside the title link;
- keep language, line count, byte size, title, description, and `data-clip-card`.

In `src/lib/remark-reference-card.ts`:

- remove the `.reference-card__action` anchor and its dedicated aria label;
- retain source, title link, description, and existing safe new-tab attributes.

- [ ] **Step 4: Run focused tests and verify they pass**

Run:

```powershell
npm test -- --run tests/clip-ui.test.ts tests/reference-ui.test.ts
```

Expected: all focused tests pass.

---

### Task 2: Unify card border interaction and remove obsolete CTA CSS

**Files:**
- Modify: `tests/clip-ui.test.ts`
- Modify: `tests/reference-ui.test.ts`
- Modify: `tests/problem-ui.test.ts`
- Modify: `tests/callout-ui.test.ts`
- Modify: `src/styles/global.css`

**Interfaces:**
- Consumes: existing `.glass` base border and the four card selectors.
- Produces: shared low-contrast default borders, accent hover borders, stronger accent focus states, and no article-card CTA styling.

- [ ] **Step 1: Add failing CSS contract assertions**

Assert that:

- `.clip-card`, `.reference-card`, `.problem-card`, and `.callout-card` all have an accent-colored `:hover` border rule;
- link cards have an accent-colored `:focus-within` rule;
- callout hover does not translate the card;
- `.clip-card__actions` and `.reference-card__action` no longer exist in the stylesheet;
- reduced-motion coverage includes clip/reference/problem movement removal while retaining existing callout transition handling.

- [ ] **Step 2: Run the four focused UI suites and verify failure**

Run:

```powershell
npm test -- --run tests/clip-ui.test.ts tests/reference-ui.test.ts tests/problem-ui.test.ts tests/callout-ui.test.ts
```

Expected: failures for missing clip hover/focus rules and obsolete action selectors.

- [ ] **Step 3: Implement the shared border behavior**

In `src/styles/global.css`:

- add transitions and accent hover/focus border states to `.clip-card`;
- retain the reference card behavior but align its border strength with the shared values;
- change the problem card default border from the current strong accent to a low-contrast base border, keeping accent on hover/focus and difficulty colors only on decorative elements;
- keep callout layout/interaction intact while aligning its hover/focus border values;
- keep subtle card-specific hover shadows and allow only link cards to translate;
- remove `.clip-card__actions`, article-card `.clip-action` dependencies that are no longer needed, and `.reference-card__action` rules;
- retain `.clip-detail__actions` and `.clip-action` because the detail page still uses copy/download buttons;
- remove obsolete reduced-motion selectors for deleted reference/clip CTA interactions and ensure card translations are disabled.

- [ ] **Step 4: Run focused UI suites and verify they pass**

Run:

```powershell
npm test -- --run tests/clip-ui.test.ts tests/reference-ui.test.ts tests/problem-ui.test.ts tests/callout-ui.test.ts
```

Expected: all focused UI suites pass.

---

### Task 3: Simplify clip detail navigation while retaining copy/download

**Files:**
- Modify: `tests/clip-ui.test.ts`
- Modify: `src/pages/clips/[slug].astro`
- Delete: `src/scripts/clip-back.ts`

**Interfaces:**
- Consumes: shared `src/scripts/clip-copy.ts` loaded from `BaseLayout.astro`.
- Produces: a clip detail page with copy/download only and no history-based navigation enhancer.

- [ ] **Step 1: Replace the back-navigation test with the new detail-action contract**

Assert that the detail page:

- contains the copy button and raw download anchor;
- does not contain `data-clip-back`, `href="/posts/"`, or the `clip-back` import;
- continues relying on the shared copy enhancer loaded by `BaseLayout.astro`.

Assert that `src/scripts/clip-back.ts` no longer exists using `access`/`stat` rejection or remove direct reads of the deleted file.

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```powershell
npm test -- --run tests/clip-ui.test.ts
```

Expected: failure because the old return link and script are still present.

- [ ] **Step 3: Remove the return control and enhancer**

In `src/pages/clips/[slug].astro`:

- remove the “返回上一页” anchor;
- remove the `<script>` import of `../../scripts/clip-back`;
- retain the copy button, download link, status node, and all metadata.

Delete `src/scripts/clip-back.ts` after verifying it has no other references.

- [ ] **Step 4: Run the focused test and verify it passes**

Run:

```powershell
npm test -- --run tests/clip-ui.test.ts
```

Expected: all clip UI tests pass.

---

### Task 4: Apply article code-block glass material to clip detail code

**Files:**
- Modify: `tests/clip-ui.test.ts`
- Modify: `src/styles/global.css`

**Interfaces:**
- Consumes: `--code-surface`, article `pre` blur values, and Shiki-generated markup from `highlightClipCode`.
- Produces: a translucent blurred `.clip-code-shell` with a transparent nested `pre` and unchanged token foreground colors.

- [ ] **Step 1: Add failing style assertions**

Assert that `.clip-code-shell` uses:

- `background: var(--code-surface)`;
- `-webkit-backdrop-filter: blur(12px) saturate(120%)`;
- `backdrop-filter: blur(12px) saturate(120%)`;
- the article-code inset highlight/shadow language;
- a nested `.clip-code-shell pre` rule with a transparent background.

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```powershell
npm test -- --run tests/clip-ui.test.ts
```

Expected: failure because `.clip-code-shell` still uses fixed `#24292e` and lacks blur.

- [ ] **Step 3: Implement the glass code shell**

Update `.clip-code-shell` to use `var(--code-surface)`, the same blur/saturation values as `.prose pre`, and compatible border/inset shadow styling. Add `background: transparent !important` to the nested `pre` without altering Shiki token colors. Preserve current radii, minimum height, padding, overflow, and header/code-shell connected layout.

- [ ] **Step 4: Run the focused test and verify it passes**

Run:

```powershell
npm test -- --run tests/clip-ui.test.ts
```

Expected: all clip UI tests pass.

---

### Task 5: Full verification and visual regression check

**Files:**
- Verify only; do not modify generated `dist/` or `.astro/` output.

**Interfaces:**
- Consumes: all prior tasks.
- Produces: evidence that markup, types, production output, responsive layout, themes, and accessibility states remain valid.

- [ ] **Step 1: Run the complete unit suite**

```powershell
npm test -- --run
```

Expected: zero failed tests.

- [ ] **Step 2: Run Astro and TypeScript validation**

```powershell
npm run check
```

Expected: zero errors.

- [ ] **Step 3: Build the production site**

```powershell
npm run build
```

Expected: exit code 0 and generated clip/blog pages without build-time remark errors.

- [ ] **Step 4: Inspect the final diff**

Confirm the diff contains only the agreed renderer, page, script deletion, CSS, tests, spec, and plan changes. Verify no generated output, credentials, deployment files, or unrelated existing modifications were staged or rewritten.

- [ ] **Step 5: Perform visual checks if a local server/browser is available**

Inspect the Markdown guide and a clip detail page in light/dark themes at desktop and narrow widths. Confirm accent borders appear on hover/focus, callouts do not move, title links open in a new tab, and the detail code shell remains readable over the selected background.
