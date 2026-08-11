# Adaptive Eye-Friendly Solid Backgrounds Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add five selectable low-saturation solid backgrounds that automatically switch between light and dark palette values while preserving all existing image backgrounds and saved preferences.

**Architecture:** Extend the existing `BACKGROUND_PRESETS` registry into a discriminated union so it remains the source of truth for validation and preference rendering. Astro will emit light/dark thumbnail CSS variables for every preset, while `data-background` and `data-theme` selectors map solid presets to theme-specific page backgrounds without changing persistence logic.

**Tech Stack:** Astro 7, TypeScript, CSS custom properties, Vitest, Node.js file-contract tests

## Global Constraints

- Keep the existing three image presets first and keep `default` as `DEFAULT_BACKGROUND`.
- Add exactly five solid presets: 暖米, 雾灰, 鼠尾草, 晨雾蓝, and 藕粉.
- Use the approved light/dark pairs: `#EEE8DC`/`#24211C`, `#E4E6E5`/`#202322`, `#DDE5D8`/`#1E261F`, `#DCE5E9`/`#1D2428`, and `#E8DDE0`/`#282024`.
- Continue storing only the preset name in `localStorage` under `aier-background-v1`.
- Do not add assets, custom color inputs, dependencies, or storage migrations.
- Preserve existing keyboard, focus, pressed-state, theme, and invalid-value fallback behavior.

---

### Task 1: Extend the typed background preset registry

**Files:**
- Modify: `tests/background-preferences.test.ts`
- Modify: `src/lib/preferences.ts`

**Interfaces:**
- Produces: `BACKGROUND_PRESETS`, a readonly array whose entries use `kind: 'image'` with `src`, or `kind: 'solid'` with `lightColor` and `darkColor`.
- Preserves: `BackgroundName`, `DEFAULT_BACKGROUND`, and `isBackground(value: unknown): value is BackgroundName`.

- [ ] **Step 1: Write the failing registry test**

Replace the fixed three-item expectation with an exact eight-item expectation:

```ts
expect(BACKGROUND_PRESETS).toEqual([
  { name: 'default', label: '背景一', kind: 'image', src: '/site-background.webp' },
  { name: 'background-2', label: '背景二', kind: 'image', src: '/site-background-2.webp' },
  { name: 'background-3', label: '背景三', kind: 'image', src: '/site-background-3.webp' },
  { name: 'warm-rice', label: '暖米', kind: 'solid', lightColor: '#EEE8DC', darkColor: '#24211C' },
  { name: 'mist-gray', label: '雾灰', kind: 'solid', lightColor: '#E4E6E5', darkColor: '#202322' },
  { name: 'sage', label: '鼠尾草', kind: 'solid', lightColor: '#DDE5D8', darkColor: '#1E261F' },
  { name: 'morning-blue', label: '晨雾蓝', kind: 'solid', lightColor: '#DCE5E9', darkColor: '#1D2428' },
  { name: 'lotus-pink', label: '藕粉', kind: 'solid', lightColor: '#E8DDE0', darkColor: '#282024' },
]);
```

Also assert that `DEFAULT_BACKGROUND` remains `default`, every listed name is accepted, and a name such as `background-4` is rejected.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- --run tests/background-preferences.test.ts`

Expected: FAIL because the current registry contains only three entries and has no `kind` or solid palette fields.

- [ ] **Step 3: Implement the discriminated registry**

Update `src/lib/preferences.ts` with the exact eight entries from the test. Keep the existing derived `BackgroundName` type and `isBackground` lookup so validation automatically includes the new presets.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npm test -- --run tests/background-preferences.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the registry change**

```powershell
git add -- src/lib/preferences.ts tests/background-preferences.test.ts
git commit -m "feat: add adaptive solid background presets"
```

### Task 2: Render image thumbnails and adaptive solid swatches

**Files:**
- Modify: `tests/background.test.ts`
- Modify: `src/components/PreferencePanel.astro`
- Modify: `src/styles/global.css`

**Interfaces:**
- Consumes: discriminated `BACKGROUND_PRESETS` entries from Task 1.
- Produces: each `.background-choice` button has `data-background-kind`, `--background-thumbnail-light`, and `--background-thumbnail-dark` values.
- Preserves: `data-background-choice`, `aria-label`, `aria-pressed`, click handling, and `aier-background-v1` persistence.

- [ ] **Step 1: Write the failing preference-control contract test**

Extend `tests/background.test.ts` to assert that `PreferencePanel.astro` contains:

```ts
expect(panel).toContain('data-background-kind={background.kind}');
expect(panel).toContain('--background-thumbnail-light');
expect(panel).toContain('--background-thumbnail-dark');
expect(panel).toContain("background.kind === 'image'");
```

Also assert that CSS selects dark-theme thumbnails:

```ts
expect(css).toContain(':root[data-theme="dark"] .background-choice');
expect(css).toContain('--background-thumbnail: var(--background-thumbnail-dark)');
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- --run tests/background.test.ts`

Expected: FAIL because the panel currently assumes every preset has `src` and only emits `--background-thumbnail`.

- [ ] **Step 3: Render typed thumbnail variables**

In `PreferencePanel.astro`, derive the style for each button:

```astro
style={background.kind === 'image'
  ? `--background-thumbnail-light: url('${background.src}'); --background-thumbnail-dark: url('${background.src}')`
  : `--background-thumbnail-light: linear-gradient(${background.lightColor}, ${background.lightColor}); --background-thumbnail-dark: linear-gradient(${background.darkColor}, ${background.darkColor})`
}
```

Add `data-background-kind={background.kind}`. Do not change the existing event listeners or saved-value logic.

- [ ] **Step 4: Add theme-aware swatch CSS**

Update the existing thumbnail rule to resolve through a light variable by default:

```css
.background-choice {
  --background-thumbnail: var(--background-thumbnail-light);
  /* retain existing declarations */
}
:root[data-theme="dark"] .background-choice {
  --background-thumbnail: var(--background-thumbnail-dark);
}
```

Keep the existing gradient shade, hover state, selected state, dimensions, and grid layout.

- [ ] **Step 5: Run the focused test and verify GREEN**

Run: `npm test -- --run tests/background.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit the preference UI change**

```powershell
git add -- src/components/PreferencePanel.astro src/styles/global.css tests/background.test.ts
git commit -m "feat: render adaptive background swatches"
```

### Task 3: Map every solid preset to light and dark page colors

**Files:**
- Modify: `tests/background.test.ts`
- Modify: `src/styles/global.css`

**Interfaces:**
- Consumes: the five solid preset names from Task 1.
- Produces: `data-background` selectors that set `--page-background` and `--backdrop-overlay` for both resolved themes.
- Preserves: the body contract `background-image: var(--backdrop-overlay), var(--page-background)` and existing image overlays.

- [ ] **Step 1: Write the failing light/dark CSS mapping test**

Add a table-driven assertion to `tests/background.test.ts`:

```ts
const solidBackgrounds = [
  ['warm-rice', '#EEE8DC', '#24211C'],
  ['mist-gray', '#E4E6E5', '#202322'],
  ['sage', '#DDE5D8', '#1E261F'],
  ['morning-blue', '#DCE5E9', '#1D2428'],
  ['lotus-pink', '#E8DDE0', '#282024'],
] as const;

for (const [name, lightColor, darkColor] of solidBackgrounds) {
  expect(css).toContain(`:root[data-background='${name}']`);
  expect(css).toContain(`linear-gradient(${lightColor}, ${lightColor})`);
  expect(css).toContain(`:root[data-theme="dark"][data-background='${name}']`);
  expect(css).toContain(`linear-gradient(${darkColor}, ${darkColor})`);
}
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- --run tests/background.test.ts`

Expected: FAIL because no solid page-background selectors exist.

- [ ] **Step 3: Add the light-theme mappings**

Add one selector for each solid preset near the existing image background selectors. Each selector sets `--page-background` to `linear-gradient(<approved-color>, <approved-color>)` and sets `--backdrop-overlay` to a transparent gradient so the selected solid color is not obscured.

- [ ] **Step 4: Add the dark-theme mappings**

After the base dark-theme token block, add one combined-theme selector per solid preset using the form:

```css
:root[data-theme="dark"][data-background='warm-rice'] {
  --page-background: linear-gradient(#24211C, #24211C);
  --backdrop-overlay: linear-gradient(transparent, transparent);
}
```

Repeat with the exact approved dark value for the other four presets.

- [ ] **Step 5: Run the focused test and verify GREEN**

Run: `npm test -- --run tests/background.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit the page mapping change**

```powershell
git add -- src/styles/global.css tests/background.test.ts
git commit -m "feat: apply solid backgrounds across themes"
```

### Task 4: Full validation and visual regression check

**Files:**
- Verify only; modify production or test files only if a failing check reveals a defect, and add a regression assertion before fixing it.

**Interfaces:**
- Validates all outputs from Tasks 1-3 together.

- [ ] **Step 1: Run static validation**

Run: `npm run check`

Expected: PASS with no Astro or TypeScript errors.

- [ ] **Step 2: Run the complete test suite**

Run: `npm test -- --run`

Expected: all Vitest tests PASS.

- [ ] **Step 3: Build the production site**

Run: `npm run build`

Expected: PASS and generate `dist/` without editing or committing generated output.

- [ ] **Step 4: Inspect the production contracts**

Confirm the generated HTML includes all eight background controls and that generated CSS contains both light and dark colors for all five solid presets. Verify no generated files are staged.

- [ ] **Step 5: Review the working tree**

Run: `git status --short` and `git diff --check`.

Expected: only intentional source/test changes are present before the final commit; no whitespace errors, `.env*`, logs, or generated directories are staged.
