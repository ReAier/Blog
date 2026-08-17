# Post List Backdrop Blur Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one continuous responsive frosted-glass surface behind the shared article list used by the home page’s “最近更新” section and the `/posts/` page.

**Architecture:** Keep the existing Astro markup unchanged because both views already use `.post-list`. Add theme-aware CSS custom properties and apply the glass material, clipping, spacing, mobile tuning, and unsupported-browser fallback in `src/styles/global.css`; protect the visual contract with a focused Vitest source test.

**Tech Stack:** Astro 7, CSS custom properties, `backdrop-filter`, TypeScript, Vitest 4.

## Global Constraints

- Apply the effect to the shared `.post-list`, covering both homepage “最近更新” and `/posts/` without duplicating template code.
- Keep the list as one continuous panel; do not turn rows into independent cards.
- Preserve existing dividers, hover gradient, focus behavior, accent rail, and title movement.
- Do not change article data, ordering, links, copy, or the homepage featured-card design.
- Support light theme, dark theme, solid-color backgrounds, mobile layouts, and browsers without `backdrop-filter`.
- Do not edit generated directories including `dist/`, `.astro/`, or `.deploy/`.

---

## File Structure

- Create `tests/post-list-glass.test.ts`: source-contract tests for the shared glass panel, row clipping, mobile tuning, and fallback.
- Modify `src/styles/global.css`: define post-list glass tokens and style the shared list surface.
- No Astro component or page changes are required.

### Task 1: Protect and implement the shared frosted article list

**Files:**
- Create: `tests/post-list-glass.test.ts`
- Modify: `src/styles/global.css:7-80`
- Modify: `src/styles/global.css:203-229`
- Modify: `src/styles/global.css:291-293`

**Interfaces:**
- Consumes: Existing `.post-list`, `.post-list-item`, `.post-list-item__link`, `.post-list--compact`, theme variables, and the `@media (max-width: 760px)` breakpoint.
- Produces: CSS custom properties `--post-list-surface`, `--post-list-surface-fallback`, and `--post-list-shadow`; one shared frosted `.post-list` panel with mobile and unsupported-browser behavior.

- [ ] **Step 1: Write the failing visual-contract test**

Create `tests/post-list-glass.test.ts` with:

```ts
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const root = new URL('../', import.meta.url);

const readCss = () => readFile(new URL('src/styles/global.css', root), 'utf8');

describe('post list glass surface', () => {
  it('uses one clipped backdrop-blurred panel for every shared post list', async () => {
    const css = await readCss();

    expect(css).toMatch(/\.post-list\s*\{[^}]*overflow:\s*hidden[^}]*border:\s*1px solid var\(--line\)[^}]*border-radius:\s*20px[^}]*background:\s*var\(--post-list-surface\)[^}]*backdrop-filter:\s*blur\(16px\) saturate\(125%\)/s);
    expect(css).toMatch(/\.post-list-item:last-child\s*\{[^}]*border-bottom:\s*0/s);
    expect(css).toMatch(/\.post-list-item__link\s*\{[^}]*margin-inline:\s*0[^}]*padding:\s*28px 22px/s);
  });

  it('defines theme-aware tokens plus mobile and unsupported-browser fallbacks', async () => {
    const css = await readCss();

    expect(css).toContain('--post-list-surface: rgba(255, 254, 250, .46);');
    expect(css).toContain('--post-list-surface: rgba(16, 18, 20, .48);');
    expect(css).toMatch(/@media \(max-width: 760px\)[\s\S]*?\.post-list\s*\{[^}]*border-radius:\s*16px[^}]*backdrop-filter:\s*blur\(12px\) saturate\(120%\)/);
    expect(css).toMatch(/@supports not \(\(backdrop-filter: blur\(1px\)\) or \(-webkit-backdrop-filter: blur\(1px\)\)\)[\s\S]*?\.post-list\s*\{[^}]*background:\s*var\(--post-list-surface-fallback\)/);
  });
});
```

- [ ] **Step 2: Run the focused test and verify the new contract fails**

Run:

```powershell
npm test -- --run tests/post-list-glass.test.ts
```

Expected: FAIL because `.post-list` does not yet define the glass material, clipping, rounded border, mobile blur, or fallback.

- [ ] **Step 3: Add light and dark post-list material tokens**

In the light `:root` block in `src/styles/global.css`, immediately after `--post-card-hover-shadow`, add:

```css
  --post-list-surface: rgba(255, 254, 250, .46);
  --post-list-surface-fallback: rgba(255, 254, 250, .9);
  --post-list-shadow: 0 22px 64px rgba(38, 35, 29, .1);
```

In `:root[data-theme="dark"]`, immediately after `--post-card-hover-shadow`, add:

```css
  --post-list-surface: rgba(16, 18, 20, .48);
  --post-list-surface-fallback: rgba(16, 18, 20, .92);
  --post-list-shadow: 0 24px 68px rgba(0, 0, 0, .3);
```

- [ ] **Step 4: Turn `.post-list` into one continuous glass panel**

Replace the existing `.post-list`, `.post-list-item`, and `.post-list-item__link` declarations with:

```css
.post-list {
  margin: 0;
  padding: 0;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 20px;
  background: var(--post-list-surface);
  box-shadow: inset 0 1px rgba(255, 255, 255, .06), var(--post-list-shadow);
  -webkit-backdrop-filter: blur(16px) saturate(125%);
  backdrop-filter: blur(16px) saturate(125%);
  list-style: none;
}
.post-list-item { position: relative; border-bottom: 1px solid var(--line); }
.post-list-item:last-child { border-bottom: 0; }
.post-list-item__link { display: grid; grid-template-columns: minmax(118px, .22fr) minmax(0, 1fr) minmax(130px, .3fr); gap: 24px; align-items: start; margin-inline: 0; padding: 28px 22px; color: inherit; text-decoration: none; background: linear-gradient(90deg, rgba(var(--accent-rgb), 0), transparent 72%); transition: color var(--motion-fast), background-color var(--motion-fast), background-image var(--motion-base), padding var(--motion-base) var(--motion-ease); }
```

Keep all subsequent hover, focus, date, content, tag, compact-list, and motion declarations unchanged.

- [ ] **Step 5: Add mobile tuning without changing the existing one-column layout**

At the start of the existing `@media (max-width: 760px)` block, add:

```css
  .post-list {
    border-radius: 16px;
    -webkit-backdrop-filter: blur(12px) saturate(120%);
    backdrop-filter: blur(12px) saturate(120%);
  }
```

Update the existing mobile `.post-list-item__link` declaration so it includes horizontal padding:

```css
  .post-list-item__link { grid-template-columns: 1fr; gap: 10px; padding: 24px 18px; }
```

Keep the compact-list override at `padding-block: 20px` so it inherits the new `18px` horizontal padding.

- [ ] **Step 6: Add the unsupported-browser fallback**

Update the existing fallback block to include `.post-list` separately because it uses a dedicated fallback token:

```css
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .glass, .post-card { background: var(--surface-solid); }
  .post-list { background: var(--post-list-surface-fallback); }
}
```

- [ ] **Step 7: Run the focused test and verify it passes**

Run:

```powershell
npm test -- --run tests/post-list-glass.test.ts
```

Expected: PASS with 2 tests passing.

- [ ] **Step 8: Run static validation**

Run:

```powershell
npm run check
```

Expected: exit code 0 with no Astro or TypeScript errors.

- [ ] **Step 9: Commit the tested implementation**

```powershell
git add -- src/styles/global.css tests/post-list-glass.test.ts
git commit -m "feat: add glass surface to post lists"
```

### Task 2: Verify production output and visual behavior

**Files:**
- Verify: `src/pages/index.astro`
- Verify: `src/pages/posts/index.astro`
- Verify: `dist/index.html`
- Verify: `dist/posts/index.html`

**Interfaces:**
- Consumes: The shared `.post-list` CSS contract from Task 1 and the unchanged Astro pages that render it.
- Produces: Verified production output for both target pages across desktop/mobile and light/dark themes.

- [ ] **Step 1: Run the complete Vitest suite**

Run:

```powershell
npm test -- --run
```

Expected: all tests pass with exit code 0.

- [ ] **Step 2: Build the production site**

Run:

```powershell
npm run build
```

Expected: Astro check and build both complete with exit code 0; `dist/index.html` and `dist/posts/index.html` are generated.

- [ ] **Step 3: Confirm both rendered pages use the shared list class**

Run:

```powershell
Select-String -Path dist/index.html,dist/posts/index.html -Pattern 'class="post-list'
```

Expected: at least one match in each file; the homepage match includes `post-list--compact` and the posts page match includes `post-list`.

- [ ] **Step 4: Perform browser visual QA**

Start the production preview:

```powershell
npm run preview -- --host 127.0.0.1
```

Check `http://127.0.0.1:4321/` and `http://127.0.0.1:4321/posts/` at desktop width and at approximately `390px` width. For each page, verify:

- The entire list is one continuous rounded glass panel.
- The background image remains visible but softened behind the panel.
- Light and dark themes have readable text and appropriately tinted glass surfaces.
- The first and last hover backgrounds remain clipped to the outer radius.
- Row dividers, accent rail, keyboard focus, title movement, dates, descriptions, and tags remain intact.
- Mobile layout remains one column with `18px` horizontal padding and no horizontal overflow.

Stop the preview server after inspection.

- [ ] **Step 5: Commit only if visual QA requires a correction**

If visual QA required a CSS correction, rerun the focused test, full test suite, and build, then commit only the corrected files:

```powershell
git add -- src/styles/global.css tests/post-list-glass.test.ts
git commit -m "fix: refine post list glass presentation"
```

If no correction was required, do not create an empty commit.
