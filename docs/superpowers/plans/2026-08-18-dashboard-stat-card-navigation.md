# Dashboard Stat Card Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the four dashboard statistic cards accessible navigation links with a restrained floating interaction, while showing real clipboard and image directory sizes.

**Architecture:** Extend the existing dashboard snapshot with resource-specific byte totals computed by the server's recursive directory-size helper. Render the statistic definitions as React Router links, then add hover, focus-visible, and reduced-motion styles without changing the dashboard layout or introducing new components.

**Tech Stack:** TypeScript 6, React 19, React Router 7, Fastify 5, Vitest 4, Testing Library, CSS.

## Global Constraints

- Preserve the existing four-column editorial glass layout and current card content hierarchy.
- Route mappings are exactly: `/posts`, `/clips`, `/images`, and `/publish`.
- Hover raises a card by `6px` with an approximately `220ms` transition.
- Keyboard focus must remain visible and must not depend on motion alone.
- `prefers-reduced-motion: reduce` disables card movement and transitions.
- Retain `storageBytes` with its current whole-content-root meaning for compatibility.
- Add resource-specific `clipStorageBytes` and `imageStorageBytes` fields.
- Do not modify generated directories such as `admin/client/dist/`, `dist/`, `.astro/`, or `.deploy/`.
- Do not overwrite unrelated changes already present in the dirty working tree.

---

### Task 1: Add resource-specific dashboard storage metrics

**Files:**
- Modify: `tests/admin-api-contract.test.ts`
- Modify: `admin/server/app.ts:66-80, 393`
- Modify: `admin/client/src/types.ts:165-177`

**Interfaces:**
- Consumes: existing `directoryBytes(root: string): Promise<number>` helper and `AdminConfig.contentRoot`.
- Produces: `DashboardSnapshot.clipStorageBytes?: number` and `DashboardSnapshot.imageStorageBytes?: number`.

- [ ] **Step 1: Write the failing API contract test**

Update `fixture` to return `contentRoot` by changing:

```typescript
return { app, database };
```

to:

```typescript
return { app, database, contentRoot };
```

Then add this test inside the existing `describe('admin API client contract', ...)` block in `tests/admin-api-contract.test.ts`:

```typescript
it('reports clipboard and image storage independently on the dashboard', async () => {
  const { app, database, contentRoot } = await fixture();
  await writeFile(join(contentRoot, 'clips', 'size-probe.txt'), '12345');
  await writeFile(join(contentRoot, 'images', 'size-probe.webp'), '1234567');

  const dashboard = await app.inject({ method: 'GET', url: '/api/dashboard' });

  expect(dashboard.statusCode, dashboard.body).toBe(200);
  expect(dashboard.json()).toMatchObject({
    clipStorageBytes: 5,
    imageStorageBytes: 7,
  });
  expect(dashboard.json().storageBytes).toBeGreaterThan(12);
  await app.close();
  database.close();
});
```
- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
npm test -- --run tests/admin-api-contract.test.ts -t "reports clipboard and image storage independently"
```

Expected: FAIL because `clipStorageBytes` and `imageStorageBytes` are absent from the dashboard response.

- [ ] **Step 3: Extend the dashboard response type**

In `admin/client/src/types.ts`, update the end of `DashboardSnapshot` to:

```typescript
  latestPublish?: PublishJob;
  storageBytes?: number;
  clipStorageBytes?: number;
  imageStorageBytes?: number;
}
```

- [ ] **Step 4: Return directory-specific totals from the server**

In `admin/server/app.ts`, keep the existing compatibility field and add the two new fields:

```typescript
      storageBytes: await directoryBytes(config.contentRoot),
      clipStorageBytes: await directoryBytes(resolve(config.contentRoot, 'clips')),
      imageStorageBytes: await directoryBytes(resolve(config.contentRoot, 'images')),
```

The existing `resolve` import and recursive `directoryBytes` helper must be reused; do not add another size utility.

- [ ] **Step 5: Run the focused API test and verify GREEN**

Run:

```powershell
npm test -- --run tests/admin-api-contract.test.ts -t "reports clipboard and image storage independently"
```

Expected: PASS with one matching test and no failures.

- [ ] **Step 6: Run the complete API contract file**

Run:

```powershell
npm test -- --run tests/admin-api-contract.test.ts
```

Expected: all tests in `tests/admin-api-contract.test.ts` pass.

- [ ] **Step 7: Commit the API contract change if Git metadata is writable**

```powershell
git add -- tests/admin-api-contract.test.ts admin/server/app.ts admin/client/src/types.ts
git commit -m "feat: expose dashboard resource storage sizes"
```

If `.git/index.lock` remains permission-denied, leave the files uncommitted and report that limitation rather than changing Git permissions.

---

### Task 2: Render the dashboard cards as route links with formatted sizes

**Files:**
- Create: `tests/admin-dashboard-navigation.test.tsx`
- Modify: `admin/client/src/pages/DashboardPage.tsx:12-32`

**Interfaces:**
- Consumes: `DashboardSnapshot.clipStorageBytes`, `DashboardSnapshot.imageStorageBytes`, existing `formatBytes`, and React Router `Link`.
- Produces: four `.stat-card` links with exact destinations `/posts`, `/clips`, `/images`, and `/publish`.

- [ ] **Step 1: Write the failing component test**

Create `tests/admin-dashboard-navigation.test.tsx` with:

```typescript
// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { DashboardPage } from '../admin/client/src/pages/DashboardPage';

const { dashboard } = vi.hoisted(() => ({
  dashboard: vi.fn(),
}));

vi.mock('../admin/client/src/api/client', () => ({
  api: { dashboard },
}));

beforeEach(() => {
  dashboard.mockResolvedValue({
    counts: { posts: 4, drafts: 1, clips: 11, images: 3 },
    recentPosts: [],
    clipStorageBytes: 643686,
    imageStorageBytes: 1280,
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('dashboard statistic navigation', () => {
  it('links every statistic card to its matching workspace page', async () => {
    render(<MemoryRouter><DashboardPage /></MemoryRouter>);

    await waitFor(() => expect(dashboard).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('link', { name: /全部文章/ })).toHaveAttribute('href', '/posts');
    expect(screen.getByRole('link', { name: /剪切板/ })).toHaveAttribute('href', '/clips');
    expect(screen.getByRole('link', { name: /图片资产/ })).toHaveAttribute('href', '/images');
    expect(screen.getByRole('link', { name: /最近发布/ })).toHaveAttribute('href', '/publish');
  });

  it('shows resource-specific formatted sizes for clips and images', async () => {
    render(<MemoryRouter><DashboardPage /></MemoryRouter>);

    expect(await screen.findByText('628.6 KB')).toBeInTheDocument();
    expect(screen.getByText('1.3 KB')).toBeInTheDocument();
    expect(screen.queryByText('独立复用内容')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the component test and verify RED**

Run:

```powershell
npm test -- --run tests/admin-dashboard-navigation.test.tsx
```

Expected: FAIL because the statistics are articles without `href` attributes and the clipboard detail is still `独立复用内容`.

- [ ] **Step 3: Add exact destinations and resource details to the stat definitions**

In `admin/client/src/pages/DashboardPage.tsx`, replace the `stats` array with:

```typescript
  const stats = [
    { label: '全部文章', value: data.counts.posts, detail: `${data.counts.drafts} 篇草稿`, mark: '文', to: '/posts' },
    { label: '剪切板', value: data.counts.clips, detail: formatBytes(data.clipStorageBytes), mark: '</>', to: '/clips' },
    { label: '图片资产', value: data.counts.images, detail: formatBytes(data.imageStorageBytes), mark: '▧', to: '/images' },
    { label: '最近发布', value: data.latestPublish?.status === 'succeeded' ? '正常' : data.latestPublish?.status ?? '暂无', detail: data.latestPublish ? formatDate(data.latestPublish.startedAt) : '尚无记录', mark: '↗', to: '/publish' },
  ];
```

- [ ] **Step 4: Replace each statistic article with a full-card link**

Replace the mapped card element with:

```tsx
          <Link className="stat-card" key={stat.label} to={stat.to}>
            <span className="stat-index">0{index + 1}</span>
            <span className="stat-mark" aria-hidden="true">{stat.mark}</span>
            <strong>{stat.value}</strong>
            <h2>{stat.label}</h2>
            <p>{stat.detail}</p>
          </Link>
```

Do not add `onClick`, `role="link"`, or imperative navigation; the native anchor produced by `Link` supplies the interaction semantics.

- [ ] **Step 5: Run the component test and verify GREEN**

Run:

```powershell
npm test -- --run tests/admin-dashboard-navigation.test.tsx
```

Expected: both tests pass.

- [ ] **Step 6: Commit the card navigation change if Git metadata is writable**

```powershell
git add -- tests/admin-dashboard-navigation.test.tsx admin/client/src/pages/DashboardPage.tsx
git commit -m "feat: link dashboard statistic cards"
```

If Git is still read-only, preserve the working-tree changes and continue.

---

### Task 3: Add floating hover, focus, and reduced-motion styles

**Files:**
- Modify: `tests/admin-client-visual.test.ts:98-106`
- Modify: `admin/client/src/styles.css:90-98, 2160-2164`

**Interfaces:**
- Consumes: `.stat-card` links emitted by `DashboardPage` and existing theme variables `--line`, `--line-strong`, `--accent-rgb`, and `--article-glass-shadow`.
- Produces: a `6px` floating interaction, accent border/shadow feedback, visible focus outline, and reduced-motion override.

- [ ] **Step 1: Write the failing CSS contract test**

Add this test to the existing `describe('admin dashboard composition', ...)` block in `tests/admin-client-visual.test.ts`:

```typescript
  it('gives statistic links a floating focus treatment with reduced-motion support', async () => {
    const styles = await read('styles.css');

    expect(styles).toMatch(/\.stat-card\s*\{[^}]*text-decoration:\s*none[^}]*transition:\s*transform 220ms/s);
    expect(styles).toMatch(/\.stat-card:hover[\s\S]*transform:\s*translateY\(-6px\)/);
    expect(styles).toMatch(/\.stat-card:focus-visible[\s\S]*outline:\s*2px solid/);
    expect(styles).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*\.stat-card[\s\S]*transition:\s*none[\s\S]*transform:\s*none/);
  });
```

- [ ] **Step 2: Run the CSS contract test and verify RED**

Run:

```powershell
npm test -- --run tests/admin-client-visual.test.ts -t "gives statistic links a floating focus treatment"
```

Expected: FAIL because the link reset, transition, hover transform, focus-visible outline, and reduced-motion override do not yet exist.

- [ ] **Step 3: Add the base link and transition styles**

Replace the current one-line `.stat-card` rule in `admin/client/src/styles.css` with:

```css
.stat-card {
  position: relative;
  min-height: 166px;
  padding: 22px;
  overflow: hidden;
  color: inherit;
  text-decoration: none;
  background: rgba(251,247,238,.58);
  border-right: 1px solid var(--line);
  transition: transform 220ms ease, border-color 220ms ease, box-shadow 220ms ease;
}
```

- [ ] **Step 4: Add pointer and keyboard interaction states**

Immediately after `.stat-card:last-child`, add:

```css
.stat-card:hover,
.stat-card:focus-visible {
  z-index: 1;
  transform: translateY(-6px);
  border-color: rgba(var(--accent-rgb), .42);
  box-shadow: 0 18px 34px rgb(0 0 0 / .18), 0 0 0 1px rgba(var(--accent-rgb), .1);
}
.stat-card:focus-visible {
  outline: 2px solid rgba(var(--accent-rgb), .72);
  outline-offset: 3px;
}
```

Keep the existing circular pseudo-element, typography rules, and glass-material overrides intact.

- [ ] **Step 5: Add the reduced-motion override**

Inside the existing `@media (prefers-reduced-motion: reduce)` block, add:

```css
  .stat-card {
    transition: none;
  }
  .stat-card:hover,
  .stat-card:focus-visible {
    transform: none;
  }
```

The border, shadow, and focus outline remain so interactivity is still visible without motion.

- [ ] **Step 6: Run the focused CSS test and verify GREEN**

Run:

```powershell
npm test -- --run tests/admin-client-visual.test.ts -t "gives statistic links a floating focus treatment"
```

Expected: PASS.

- [ ] **Step 7: Run all dashboard-related tests**

Run:

```powershell
npm test -- --run tests/admin-api-contract.test.ts tests/admin-dashboard-navigation.test.tsx tests/admin-client-visual.test.ts
```

Expected: all selected test files pass with zero failures.

- [ ] **Step 8: Commit the interaction styles if Git metadata is writable**

```powershell
git add -- tests/admin-client-visual.test.ts admin/client/src/styles.css
git commit -m "feat: animate dashboard statistic cards"
```

If Git remains read-only, do not request broader filesystem permissions solely to commit.

---

### Task 4: Verify the complete admin client and production build

**Files:**
- Verify only; no planned production edits.

**Interfaces:**
- Consumes: all changes from Tasks 1–3.
- Produces: fresh test, type-check, and build evidence.

- [ ] **Step 1: Run the full Vitest suite once**

```powershell
npm test -- --run
```

Expected: all test files pass with zero failed tests.

- [ ] **Step 2: Run admin and Astro type validation**

```powershell
npm run admin:check
```

Expected: TypeScript and Astro checks exit with code `0`.

- [ ] **Step 3: Build the admin client**

```powershell
npm run admin:build
```

Expected: Vite build exits with code `0`. Do not commit generated `admin/client/dist/` output.

- [ ] **Step 4: Build the production Astro site**

```powershell
npm run build
```

Expected: Astro validation and production generation exit with code `0`. Do not commit generated output.

- [ ] **Step 5: Inspect only the intended source diff**

```powershell
git diff --check -- admin/server/app.ts admin/client/src/types.ts admin/client/src/pages/DashboardPage.tsx admin/client/src/styles.css tests/admin-api-contract.test.ts tests/admin-dashboard-navigation.test.tsx tests/admin-client-visual.test.ts
git diff -- admin/server/app.ts admin/client/src/types.ts admin/client/src/pages/DashboardPage.tsx admin/client/src/styles.css tests/admin-api-contract.test.ts tests/admin-dashboard-navigation.test.tsx tests/admin-client-visual.test.ts
```

Expected: no whitespace errors; changes are limited to resource metrics, card navigation, animation styles, and their tests. Existing unrelated working-tree modifications remain untouched.
