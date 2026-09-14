# Admin Shared Site Header Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the React admin header use the same maintained visual stylesheet as the Astro public-site header while preserving all admin navigation and utility behavior.

**Architecture:** Extract the public header’s layout, navigation, controls, responsive behavior, and motion rules into `src/styles/site-header.css`. Both style entry points import that file; the Astro and React components retain framework-specific behavior but expose the same structural class contract. Admin-only CSS remains responsible only for menus, permission-aware navigation behavior, and layout offsets.

**Tech Stack:** Astro 7, React 19, React Router 7, TypeScript 6, CSS, Vitest 4, Vite 7.

## Global Constraints

- Do not import the complete public `global.css` into the admin client.
- Preserve admin routes, permissions, logout, appearance settings, settings menu, and mobile-menu behavior.
- Preserve the existing public navigation indicator behavior driven by `src/scripts/motion-controller.ts`.
- Do not alter unrelated uncommitted workspace changes.
- Use two-space indentation, single quotes in TypeScript, semicolons, and trailing commas in multiline structures.
- Run both focused tests and production builds before completion.

---

## File Map

- Create `src/styles/site-header.css`: shared header-only visual contract used by Astro and React.
- Modify `src/styles/global.css`: import the shared header file and remove declarations moved into it.
- Modify `admin/client/src/styles.css`: import the shared header file, remove duplicate admin header visuals, and keep admin-only adapters/menu rules.
- Modify `admin/client/src/components/AppShell.tsx`: add shared structural classes and accessible active-page semantics.
- Modify `admin/client/src/components/AppearanceControls.tsx`: apply the shared icon-button class to the appearance trigger.
- Modify `tests/admin-client-visual.test.ts`: enforce shared imports, shared class usage, retained admin functions, and shared CSS contracts.

---

### Task 1: Add the shared-header contract tests

**Files:**
- Modify: `tests/admin-client-visual.test.ts`
- Test: `tests/admin-client-visual.test.ts`

**Interfaces:**
- Consumes: filesystem paths rooted at `process.cwd()`.
- Produces: regression contracts for `src/styles/site-header.css`, both CSS imports, and shared React class names.

- [ ] **Step 1: Add a project-root reader and failing shared-style tests**

Add beside the existing `read` helper:

```ts
const readProjectFile = (path: string) => readFile(join(process.cwd(), path), 'utf8');
```

Add this describe block:

```ts
describe('shared public and admin site header', () => {
  it('loads one header stylesheet from both visual entry points', async () => {
    const publicCss = await readProjectFile('src/styles/global.css');
    const adminCss = await read('styles.css');

    expect(publicCss).toContain("@import './site-header.css';");
    expect(adminCss).toContain("@import '../../../src/styles/site-header.css';");
  });

  it('defines the shared shell, navigation indicator, controls, and mobile contract', async () => {
    const css = await readProjectFile('src/styles/site-header.css');

    expect(css).toContain('.site-header');
    expect(css).toContain('.nav-shell');
    expect(css).toContain('.nav-shell.glass');
    expect(css).toContain('.site-mark');
    expect(css).toContain('.site-nav');
    expect(css).toContain('.nav-indicator');
    expect(css).toContain('.header-actions');
    expect(css).toContain('.icon-button');
    expect(css).toContain('@media (max-width: 760px)');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
  });

  it('uses the shared class contract without removing admin behavior', async () => {
    const shell = await read('components/AppShell.tsx');
    const appearance = await read('components/AppearanceControls.tsx');

    expect(shell).toContain('className="admin-header site-header"');
    expect(shell).toContain('className="admin-header-inner nav-shell glass"');
    expect(shell).toContain('className="admin-wordmark site-mark"');
    expect(shell).toContain('className="admin-nav site-nav"');
    expect(shell).toContain('className="admin-utilities header-actions"');
    expect(shell).toContain('aria-label="设置"');
    expect(shell).toContain('hasPermission(item.permission)');
    expect(appearance).toContain('className="appearance-trigger icon-button"');
  });
});
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```powershell
npm test -- --run tests/admin-client-visual.test.ts
```

Expected: FAIL because `src/styles/site-header.css` does not exist and neither entry point imports it.

- [ ] **Step 3: Commit the failing contract test**

```powershell
git add tests/admin-client-visual.test.ts
git commit -m "test: define shared site header contract"
```

---

### Task 2: Extract the public header visual rules

**Files:**
- Create: `src/styles/site-header.css`
- Modify: `src/styles/global.css:1-124, 283-305, 489-500, 519-542, 570-609, 1138-1146`
- Modify: `admin/client/src/styles.css:1-2`
- Test: `tests/admin-client-visual.test.ts`

**Interfaces:**
- Consumes: CSS variables `--line`, `--surface`, `--shadow`, `--accent`, `--accent-rgb`, `--text`, `--muted`, and `--mono` supplied by each app. The shared file supplies fallbacks for its width and motion custom properties so the admin does not depend on public-only tokens.
- Produces: shared classes `.site-header`, `.nav-shell`, `.site-mark`, `.site-nav`, `.nav-indicator`, `.header-actions`, `.icon-button`, and `.mobile-toggle`.

- [ ] **Step 1: Create the shared stylesheet with the public header contract**

Create `src/styles/site-header.css` with the header-only declarations currently spread through `global.css`. The core desktop rules must be:

```css
.site-header {
  --site-header-content: var(--content, 1160px);
  --site-header-motion-fast: var(--motion-fast, 160ms);
  --site-header-motion-base: var(--motion-base, 280ms);
  --site-header-motion-ease: var(--motion-ease, cubic-bezier(.22, 1, .36, 1));
  position: fixed;
  z-index: 90;
  top: 14px;
  left: 0;
  right: 0;
  pointer-events: none;
  transition: top var(--site-header-motion-base) var(--site-header-motion-ease);
}

.nav-shell.glass {
  border: 1px solid var(--line);
  background: var(--surface);
  box-shadow: var(--shadow);
  -webkit-backdrop-filter: blur(22px) saturate(145%);
  backdrop-filter: blur(22px) saturate(145%);
}

.nav-shell {
  width: min(calc(100% - 40px), var(--site-header-content));
  min-height: 64px;
  margin-inline: auto;
  padding: 10px 12px 10px 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  border-radius: 18px;
  pointer-events: auto;
  transition: min-height var(--motion-base) var(--motion-ease),
    padding var(--motion-base) var(--motion-ease),
    border-radius var(--motion-base) var(--motion-ease),
    background-color var(--motion-base) var(--motion-ease),
    box-shadow var(--motion-base) var(--motion-ease);
}

.site-mark {
  flex: 0 0 auto;
  font-family: var(--mono);
  font-weight: 800;
  letter-spacing: -.08em;
  text-decoration: none;
}

.site-mark span {
  display: inline-block;
  color: var(--accent);
  transform-origin: center;
  transition: transform var(--site-header-motion-fast) var(--site-header-motion-ease), color var(--site-header-motion-fast);
}

.site-mark:hover span { transform: scale(1.35); }
.site-nav { position: relative; display: flex; align-items: center; gap: 2px; }
.site-nav a { border-radius: 9px; padding: 8px 10px; color: var(--muted); font-size: .9rem; text-decoration: none; }
.site-nav a[aria-current='page'],
.site-nav a:hover { color: var(--text); background: rgba(var(--accent-rgb), .09); }
.header-actions { display: flex; align-items: center; gap: 7px; }
.icon-button { width: 40px; height: 40px; display: inline-grid; place-items: center; border: 1px solid var(--line); border-radius: 11px; background: rgba(var(--accent-rgb), .05); cursor: pointer; }
.icon-button:hover { border-color: rgba(var(--accent-rgb), .4); background: rgba(var(--accent-rgb), .11); }
.mobile-toggle { display: none; }
```

Move the existing `.nav-indicator`, compact-header, active/press, mobile navigation, menu animation, no-backdrop-filter fallback, and reduced-motion declarations from `global.css` into this file without changing their values. Scope generic transition lists so the shared file contains only header classes.

- [ ] **Step 2: Import the shared stylesheet from both applications**

At the top of `src/styles/global.css`:

```css
@import './glass-material.css';
@import './site-header.css';
```

At the top of `admin/client/src/styles.css`:

```css
@import '../../../src/styles/glass-material.css';
@import '../../../src/styles/site-header.css';
@import './styles/theme.css';
```

- [ ] **Step 3: Remove only the declarations moved from public global CSS**

Delete the duplicate header selectors from `src/styles/global.css`. Keep `.container`, `.glass`, preference-panel rules, page transitions, and non-header animation rules in place. Do not alter `src/scripts/motion-controller.ts` or `src/components/SiteHeader.astro`.

- [ ] **Step 4: Run the focused tests**

Run:

```powershell
npm test -- --run tests/admin-client-visual.test.ts tests/motion-contract.test.ts tests/ui-contract.test.ts
```

Expected: import and shared-file assertions PASS; React shared-class assertions remain FAIL until Task 3.

- [ ] **Step 5: Commit the extraction**

```powershell
git add src/styles/site-header.css src/styles/global.css admin/client/src/styles.css tests/admin-client-visual.test.ts
git commit -m "refactor: share public header styles"
```

---

### Task 3: Align the React admin shell with the shared class contract

**Files:**
- Modify: `admin/client/src/components/AppShell.tsx:20-134`
- Modify: `admin/client/src/components/AppearanceControls.tsx:61-70`
- Modify: `admin/client/src/styles.css:646-735, 987-1045, 2258-2282, 2322-2340, 2444-2468, 3238-3257`
- Test: `tests/admin-client-visual.test.ts`

**Interfaces:**
- Consumes: shared classes from `src/styles/site-header.css` and React Router `NavLink` active state.
- Produces: an admin header that visually follows the public header while retaining `.admin-*` compatibility hooks.

- [ ] **Step 1: Update admin markup to expose both shared and admin classes**

In `AppShell.tsx`, change the relevant elements to:

```tsx
<header className="admin-header site-header">
  <div className="admin-header-inner nav-shell glass">
    <NavLink className="admin-wordmark site-mark" to="/" aria-label="Aier Blog 后台首页">
      AIER<span>.</span>
    </NavLink>
```

Use:

```tsx
<nav id="admin-primary-navigation" className="admin-nav site-nav" aria-label="主导航">
```

and:

```tsx
<div className="admin-utilities header-actions">
```

Keep the existing `NavItem` render-state callback:

```tsx
<NavLink
  to={to}
  end={end}
  className={({ isActive }) => `nav-item${isActive ? ' is-active' : ''}`}
>
```

React Router automatically adds `aria-current="page"` to an active `NavLink`, so the shared selector and the `.is-active` underline fallback remain synchronized without new routing state.

- [ ] **Step 2: Apply the common icon-button class to admin utility buttons**

In `AppearanceControls.tsx`:

```tsx
className="appearance-trigger icon-button"
```

In `AppShell.tsx`:

```tsx
className="settings-trigger icon-button"
```

Give the mobile trigger the shared control surface without changing its two-line icon:

```tsx
className="menu-button icon-button"
```

- [ ] **Step 3: Reduce admin CSS to adapters and admin-only menus**

Remove desktop visual declarations duplicated by the shared classes from `.admin-header`, `.admin-header-inner`, `.admin-wordmark`, `.admin-nav`, `.nav-item`, `.appearance-trigger`, and `.settings-trigger`. Keep these admin-specific rules:

```css
.admin-header { z-index: 200; }
.admin-header { --site-header-content: 1440px; }
.admin-nav { margin-inline: auto; }
.admin-utilities { flex: 0 0 auto; }
.admin-context { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.settings-control,
.appearance-controls { position: relative; }
.settings-trigger { width: auto; min-width: 40px; padding-inline: 12px; gap: 8px; }
.settings-trigger svg { width: 17px; height: 17px; fill: none; stroke: currentColor; stroke-width: 1.8; }
```

Keep `.settings-menu`, `.appearance-panel`, their open states, fallbacks, and z-index rules. Keep `.content-canvas` top padding so fixed navigation does not overlap content. Remove the later overrides that give `.settings-trigger` a different glass material from `.icon-button`.

For active admin links, use the shared visual language with a CSS underline fallback:

```css
.admin-nav .nav-item::after {
  content: '';
  position: absolute;
  right: 10px;
  bottom: 4px;
  left: 10px;
  height: 2px;
  border-radius: 999px;
  background: var(--accent);
  transform: scaleX(0);
  transition: transform var(--site-header-motion-base) var(--site-header-motion-ease);
}

.admin-nav .nav-item.is-active::after { transform: scaleX(1); }
```

At mobile widths, retain the existing `.workspace-shell.menu-open .admin-nav` behavior and ensure the shared `.site-nav` mobile rules do not require the Astro-only `data-open` attribute. The admin selector remains the authority for showing the React menu.

- [ ] **Step 4: Run the focused tests and TypeScript check**

Run:

```powershell
npm test -- --run tests/admin-client-visual.test.ts
npm run admin:check
```

Expected: all tests in `admin-client-visual.test.ts` PASS and both TypeScript/Astro checks exit with code 0.

- [ ] **Step 5: Commit the React integration**

```powershell
git add admin/client/src/components/AppShell.tsx admin/client/src/components/AppearanceControls.tsx admin/client/src/styles.css tests/admin-client-visual.test.ts
git commit -m "feat: reuse blog header in admin"
```

---

### Task 4: Verify responsive behavior and production output

**Files:**
- Modify only if verification identifies a header regression: `src/styles/site-header.css`, `admin/client/src/styles.css`, or the two header components.
- Test: existing Vitest suite and production builds.

**Interfaces:**
- Consumes: completed shared CSS and aligned markup.
- Produces: fresh evidence that public and admin builds retain their behavior.

- [ ] **Step 1: Run the complete automated test suite**

```powershell
npm test -- --run
```

Expected: all Vitest files PASS with zero failures.

- [ ] **Step 2: Run both production builds**

```powershell
npm run admin:build
npm run build
```

Expected: both commands exit with code 0; the admin Vite bundle and Astro `dist/` output are generated successfully.

- [ ] **Step 3: Inspect the final diff for scope and accidental overwrites**

```powershell
git diff -- src/styles/site-header.css src/styles/global.css admin/client/src/components/AppShell.tsx admin/client/src/components/AppearanceControls.tsx admin/client/src/styles.css tests/admin-client-visual.test.ts
git status --short
```

Expected: changes are limited to the shared-header implementation plus pre-existing unrelated workspace modifications; no generated `dist/`, `.astro/`, or admin build output is staged.

- [ ] **Step 4: Perform visual smoke checks at desktop and mobile widths**

Start the public and admin development servers using the repository scripts. Check that:

- desktop public and admin headers share height, radius, width behavior, brand position, navigation spacing, control surfaces, and active accent line;
- the admin settings menu and appearance panel anchor below their triggers;
- mobile admin navigation opens and closes, Escape still closes it, and content remains reachable;
- light and dark themes retain readable text and borders;
- reduced-motion mode removes header transitions without changing layout.

- [ ] **Step 5: Commit any verification-only corrections**

If Task 4 required corrections:

```powershell
git add src/styles/site-header.css src/styles/global.css admin/client/src/components/AppShell.tsx admin/client/src/components/AppearanceControls.tsx admin/client/src/styles.css tests/admin-client-visual.test.ts
git commit -m "fix: refine shared header responsiveness"
```

If no correction was required, do not create an empty commit.
