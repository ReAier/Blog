# Admin Editorial Content Lists Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the dashboard recent-post list, article index, and clipboard index as responsive editorial rows matching the public blog's hover language without changing their data or management behavior.

**Architecture:** Keep each page's existing data fetching, filters, imports, routes, and delete workflow. Replace only the three list renderers with page-specific React markup that shares an `editorial-resource-*` CSS system; theme variables in `theme.css` provide light/dark surfaces, hover gradients, and accent borders. Contract tests inspect the React and CSS source, while the existing dashboard component test verifies real link and status output.

**Tech Stack:** React 19, React Router 7, TypeScript 6, CSS, Vitest 4, Testing Library, Vite.

## Global Constraints

- Cover only dashboard “最近稿件”, `/posts`, and `/clips`; do not change APIs, routes, editors, dashboard statistics, or publishing controls.
- Preserve search, filters, imports, deletion confirmation, and existing accessible labels.
- Use native links and buttons; delete controls must remain outside the clipboard navigation link.
- Support light and dark themes, narrow layouts, keyboard focus, and `prefers-reduced-motion: reduce`.
- Do not overwrite or stage unrelated working-tree changes; every commit stages only the files listed in its task.
- Follow two-space indentation, single quotes in TypeScript, semicolons, and trailing commas in multiline structures.

---

## File Map

- `tests/admin-editorial-content-lists.test.ts` — source-level markup and CSS contract for all three editorial lists.
- `tests/admin-dashboard-navigation.test.tsx` — rendered dashboard assertion for recent-post editor links and visible status text.
- `admin/client/src/pages/DashboardPage.tsx` — recent-post editorial row markup.
- `admin/client/src/pages/PostsPage.tsx` — article editorial list markup; existing toolbar/filter/import logic remains untouched.
- `admin/client/src/pages/ClipsPage.tsx` — clipboard editorial list markup; delete button stays separate from the navigation link.
- `admin/client/src/styles/theme.css` — light/dark editorial-row tokens.
- `admin/client/src/styles.css` — shared row layout, hover/focus, responsive behavior, and reduced-motion rules.

### Shared CSS Interface

All three page renderers consume these exact classes:

```text
.editorial-resource-list
.editorial-resource-row
.editorial-resource-link
.editorial-resource-meta
.editorial-resource-main
.editorial-resource-title
.editorial-resource-detail
.editorial-resource-aside
.editorial-resource-actions
```

Page-specific modifiers are permitted (`dashboard-story-row`, `post-resource-row`, and `clip-resource-row`) but must not duplicate the shared interaction implementation.

---

### Task 1: Lock the editorial list contract with failing tests

**Files:**
- Create: `tests/admin-editorial-content-lists.test.ts`
- Modify: `tests/admin-dashboard-navigation.test.tsx`

**Interfaces:**
- Consumes: existing page source files, `admin/client/src/styles.css`, and `admin/client/src/styles/theme.css`.
- Produces: failing requirements for the `editorial-resource-*` class interface and rendered dashboard recent-post link/status behavior.

- [ ] **Step 1: Create the source contract test**

Create `tests/admin-editorial-content-lists.test.ts`:

```ts
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const readAdmin = (path: string) => readFile(
  new URL(`../admin/client/src/${path}`, import.meta.url),
  'utf8',
);

describe('admin editorial content lists', () => {
  it('uses one editorial row vocabulary across dashboard, posts, and clips', async () => {
    const [dashboard, posts, clips] = await Promise.all([
      readAdmin('pages/DashboardPage.tsx'),
      readAdmin('pages/PostsPage.tsx'),
      readAdmin('pages/ClipsPage.tsx'),
    ]);

    for (const source of [dashboard, posts, clips]) {
      expect(source).toContain('editorial-resource-list');
      expect(source).toContain('editorial-resource-row');
      expect(source).toContain('editorial-resource-link');
      expect(source).toContain('editorial-resource-main');
      expect(source).toContain('editorial-resource-title');
      expect(source).toContain('editorial-resource-detail');
    }
    expect(posts).not.toContain('<table className="data-table post-table"');
    expect(clips).not.toContain('<table className="data-table clip-table"');
  });

  it('keeps clipboard deletion outside the editor link', async () => {
    const clips = await readAdmin('pages/ClipsPage.tsx');

    expect(clips).toMatch(/<article className="editorial-resource-row clip-resource-row"[\s\S]*?<Link className="editorial-resource-link"[\s\S]*?<\/Link>[\s\S]*?<div className="editorial-resource-actions">[\s\S]*?clip-row-delete/);
    expect(clips).toContain('aria-label={`删除 ${clip.title}`}');
  });

  it('defines themed hover, focus, responsive, and reduced-motion behavior', async () => {
    const [styles, theme] = await Promise.all([
      readAdmin('styles.css'),
      readAdmin('styles/theme.css'),
    ]);

    for (const token of [
      '--editorial-row-surface',
      '--editorial-row-hover',
      '--editorial-row-accent',
    ]) expect(theme).toContain(token);
    expect(styles).toMatch(/\.editorial-resource-row\s*\{[^}]*position:\s*relative[^}]*border-bottom:\s*1px solid var\(--line\)/s);
    expect(styles).toMatch(/\.editorial-resource-row::before\s*\{[^}]*width:\s*3px[^}]*background:\s*var\(--editorial-row-accent\)/s);
    expect(styles).toMatch(/\.editorial-resource-row:is\(:hover,\s*:focus-within\)[^{]*\{[^}]*background:\s*var\(--editorial-row-hover\)/s);
    expect(styles).toMatch(/\.editorial-resource-link:focus-visible\s*\{[^}]*outline:\s*2px solid/s);
    expect(styles).toMatch(/@media \(max-width:\s*760px\)[\s\S]*\.editorial-resource-link[\s\S]*grid-template-columns:\s*1fr/s);
    expect(styles).toMatch(/@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*\.editorial-resource-main[\s\S]*transform:\s*none/s);
  });
});
```

- [ ] **Step 2: Add a rendered recent-post dashboard test**

Append inside `describe('dashboard statistic navigation', ...)` in `tests/admin-dashboard-navigation.test.tsx`:

```tsx
  it('links recent posts to their editors and keeps status text visible', async () => {
    dashboard.mockResolvedValueOnce({
      counts: { posts: 2, drafts: 1, clips: 0, images: 0 },
      recentPosts: [
        {
          slug: 'draft-note',
          title: '草稿笔记',
          description: '尚未发布的文章',
          publishedAt: '2026-08-17',
          updatedAt: '2026-08-18',
          draft: true,
          featured: false,
          tags: ['随笔'],
          revision: 'draft-revision',
        },
        {
          slug: 'live-note',
          title: '线上文章',
          description: '已经发布的文章',
          publishedAt: '2026-08-16',
          draft: false,
          featured: false,
          tags: ['建站'],
          revision: 'live-revision',
        },
      ],
      clipStorageBytes: 0,
      imageStorageBytes: 0,
    });

    render(<MemoryRouter><DashboardPage /></MemoryRouter>);

    expect(await screen.findByRole('link', { name: /草稿笔记/ })).toHaveAttribute('href', '/posts/draft-note');
    expect(screen.getByRole('link', { name: /线上文章/ })).toHaveAttribute('href', '/posts/live-note');
    expect(screen.getByText('草稿')).toBeInTheDocument();
    expect(screen.getByText('已发布')).toBeInTheDocument();
  });
```

- [ ] **Step 3: Run the focused tests and confirm RED**

Run:

```powershell
npm test -- --run tests/admin-editorial-content-lists.test.ts tests/admin-dashboard-navigation.test.tsx
```

Expected: the dashboard rendering assertion passes against current behavior, while `admin-editorial-content-lists.test.ts` fails because the pages do not yet contain `editorial-resource-*` markup or theme tokens.

- [ ] **Step 4: Commit the failing contract tests**

```powershell
git add -- tests/admin-editorial-content-lists.test.ts tests/admin-dashboard-navigation.test.tsx
git commit -m "test: define admin editorial list contracts"
```

---

### Task 2: Build the shared editorial row system and convert dashboard recent posts

**Files:**
- Modify: `admin/client/src/pages/DashboardPage.tsx:40-50`
- Modify: `admin/client/src/styles/theme.css`
- Modify: `admin/client/src/styles.css:120-130` and responsive/reduced-motion sections
- Test: `tests/admin-editorial-content-lists.test.ts`
- Test: `tests/admin-dashboard-navigation.test.tsx`

**Interfaces:**
- Consumes: exact shared class vocabulary declared in Task 1.
- Produces: reusable theme variables and layout/interaction CSS consumed by Tasks 3 and 4.

- [ ] **Step 1: Add light and dark editorial-row tokens**

In the light theme variable block in `admin/client/src/styles/theme.css`, add:

```css
  --editorial-row-surface: rgba(255, 254, 250, .34);
  --editorial-row-hover: linear-gradient(90deg, rgba(var(--accent-rgb), .1), rgba(var(--accent-rgb), .035) 56%, transparent);
  --editorial-row-accent: var(--accent);
```

In `:root[data-theme='dark']`, add:

```css
  --editorial-row-surface: rgba(10, 13, 15, .28);
  --editorial-row-hover: linear-gradient(90deg, rgba(var(--accent-rgb), .16), rgba(var(--accent-rgb), .055) 58%, transparent);
  --editorial-row-accent: color-mix(in srgb, var(--accent) 88%, #fff);
```

- [ ] **Step 2: Replace the dashboard story markup**

Replace the current `story-list` block in `DashboardPage.tsx` with:

```tsx
          <div className="editorial-resource-list dashboard-story-list">
            {data.recentPosts.length ? data.recentPosts.slice(0, 6).map((post, index) => (
              <article className="editorial-resource-row dashboard-story-row" key={post.slug}>
                <Link className="editorial-resource-link" to={`/posts/${encodeURIComponent(post.slug)}`} aria-label={`打开文章 ${post.title}`}>
                  <span className="editorial-resource-meta">
                    <span className="story-number">{String(index + 1).padStart(2, '0')}</span>
                    <small>{formatDate(post.updatedAt || post.publishedAt)}</small>
                  </span>
                  <span className="editorial-resource-main">
                    <strong className="editorial-resource-title">{post.title}</strong>
                    <small className="editorial-resource-detail">{post.slug}</small>
                  </span>
                  <span className="editorial-resource-aside">
                    <span className={`status-pill ${post.draft ? 'status-draft' : 'status-live'}`}>{post.draft ? '草稿' : '已发布'}</span>
                  </span>
                </Link>
              </article>
            )) : <p className="muted-copy">还没有稿件。从第一篇文章开始。</p>}
          </div>
```

- [ ] **Step 3: Implement the shared desktop interaction CSS**

Replace the old `.story-list`, `.story-row`, `.story-main`, and related hover rules in `styles.css` with the shared system below. Keep `.story-number` as the dashboard-specific sequence style.

```css
.editorial-resource-list {
  overflow: hidden;
  background: var(--editorial-row-surface);
  border: 1px solid var(--line);
  border-radius: 18px;
}
.editorial-resource-row {
  position: relative;
  min-width: 0;
  background: transparent;
  border-bottom: 1px solid var(--line);
  transition: background 200ms ease, border-color 200ms ease;
}
.editorial-resource-row:last-child { border-bottom: 0; }
.editorial-resource-row::before {
  content: '';
  position: absolute;
  z-index: 2;
  inset: 0 auto 0 0;
  width: 3px;
  background: var(--editorial-row-accent);
  opacity: 0;
  transform: scaleY(.35);
  transform-origin: center;
  transition: opacity 200ms ease, transform 200ms ease;
  pointer-events: none;
}
.editorial-resource-row:is(:hover, :focus-within) { background: var(--editorial-row-hover); }
.editorial-resource-row:is(:hover, :focus-within)::before { opacity: 1; transform: scaleY(1); }
.editorial-resource-link {
  min-height: 92px;
  padding: 18px 22px;
  display: grid;
  grid-template-columns: minmax(104px, .34fr) minmax(0, 1.65fr) minmax(120px, auto);
  gap: 24px;
  align-items: center;
  color: inherit;
  text-decoration: none;
}
.editorial-resource-link:focus-visible {
  outline: 2px solid var(--editorial-row-accent);
  outline-offset: -4px;
}
.editorial-resource-meta,
.editorial-resource-main,
.editorial-resource-aside { min-width: 0; }
.editorial-resource-meta,
.editorial-resource-main { display: grid; gap: 6px; }
.editorial-resource-meta,
.editorial-resource-detail {
  color: var(--ink-faint);
  font-family: var(--mono);
  font-size: .64rem;
}
.editorial-resource-main { transition: transform 200ms ease; }
.editorial-resource-title {
  overflow: hidden;
  color: var(--ink);
  font-family: var(--serif);
  font-size: clamp(1rem, 1.35vw, 1.35rem);
  font-weight: 600;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color 200ms ease;
}
.editorial-resource-row:is(:hover, :focus-within) .editorial-resource-main { transform: translateX(2px); }
.editorial-resource-row:is(:hover, :focus-within) .editorial-resource-title { color: var(--editorial-row-accent); }
.editorial-resource-aside {
  display: flex;
  gap: 9px;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
}
.story-number { color: var(--ink-faint); font-style: italic; }
```

- [ ] **Step 4: Add responsive and reduced-motion rules**

Append to the existing `@media (max-width: 760px)` block:

```css
  .editorial-resource-link {
    min-height: 0;
    padding: 16px 18px;
    grid-template-columns: 1fr;
    gap: 10px;
  }
  .editorial-resource-meta { display: flex; gap: 12px; align-items: center; }
  .editorial-resource-title { white-space: normal; }
  .editorial-resource-aside { justify-content: flex-start; }
```

Append to the existing `@media (prefers-reduced-motion: reduce)` block, or create it if the current block cannot safely be extended:

```css
  .editorial-resource-row,
  .editorial-resource-row::before,
  .editorial-resource-main,
  .editorial-resource-title { transition: none; }
  .editorial-resource-row::before,
  .editorial-resource-row:is(:hover, :focus-within) .editorial-resource-main { transform: none; }
```

- [ ] **Step 5: Run dashboard and CSS contract tests**

Run:

```powershell
npm test -- --run tests/admin-editorial-content-lists.test.ts tests/admin-dashboard-navigation.test.tsx
```

Expected: dashboard component tests pass. The shared CSS assertions pass. The cross-page markup assertion remains failing only for `PostsPage.tsx` and `ClipsPage.tsx`, which are implemented in Tasks 3 and 4.

- [ ] **Step 6: Commit the dashboard and shared style foundation**

```powershell
git add -- admin/client/src/pages/DashboardPage.tsx admin/client/src/styles.css admin/client/src/styles/theme.css tests/admin-dashboard-navigation.test.tsx tests/admin-editorial-content-lists.test.ts
git commit -m "feat: add admin editorial row styling"
```

---

### Task 3: Convert the article table to editorial rows

**Files:**
- Modify: `admin/client/src/pages/PostsPage.tsx:65-79`
- Modify: `admin/client/src/styles.css`
- Test: `tests/admin-editorial-content-lists.test.ts`

**Interfaces:**
- Consumes: shared `editorial-resource-*` CSS from Task 2 and existing `PostSummary` fields.
- Produces: table-free article list while preserving article links, status, featured marker, tags, date, toolbar, filters, and import behavior.

- [ ] **Step 1: Replace the article table renderer**

Replace the current `<section className="data-table-wrap">...</section>` with:

```tsx
        <section className="editorial-resource-list post-resource-list" aria-label="文章列表">
          {data.items.map((post) => (
            <article className="editorial-resource-row post-resource-row" key={post.slug}>
              <Link className="editorial-resource-link" to={`/posts/${encodeURIComponent(post.slug)}`} aria-label={`打开文章 ${post.title}`}>
                <span className="editorial-resource-meta">
                  <span>{formatDate(post.publishedAt)}</span>
                  {post.updatedAt && <small>更新于 {formatDate(post.updatedAt)}</small>}
                </span>
                <span className="editorial-resource-main">
                  <strong className="editorial-resource-title">{post.title}</strong>
                  <small className="editorial-resource-detail">{post.description || post.slug}</small>
                </span>
                <span className="editorial-resource-aside">
                  <span className={`status-pill ${post.draft ? 'status-draft' : 'status-live'}`}>{post.draft ? '草稿' : '已发布'}</span>
                  {post.featured && <span className="featured-mark" title="首页精选">★</span>}
                  <span className="tag-row">{post.tags.slice(0, 3).map((tag) => <span className="tag" key={tag}>{tag}</span>)}</span>
                </span>
              </Link>
            </article>
          ))}
        </section>
```

- [ ] **Step 2: Add article-specific sizing without duplicating interaction rules**

Add to `styles.css`:

```css
.post-resource-row .editorial-resource-link {
  grid-template-columns: minmax(128px, .38fr) minmax(260px, 1.5fr) minmax(180px, .8fr);
}
.post-resource-row .editorial-resource-detail {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

Inside `@media (max-width: 760px)`, ensure the shared mobile rule wins by adding:

```css
  .post-resource-row .editorial-resource-link { grid-template-columns: 1fr; }
  .post-resource-row .editorial-resource-detail { white-space: normal; }
```

- [ ] **Step 3: Run focused tests and confirm posts are GREEN**

Run:

```powershell
npm test -- --run tests/admin-editorial-content-lists.test.ts tests/admin-client-source.test.ts
```

Expected: source checks concerning `PostsPage.tsx` pass. The shared-list test may still fail only because `ClipsPage.tsx` still uses the table markup.

- [ ] **Step 4: Run admin TypeScript validation**

Run:

```powershell
npm run admin:check
```

Expected: exit code 0 with no TypeScript or Astro validation errors.

- [ ] **Step 5: Commit the article list conversion**

```powershell
git add -- admin/client/src/pages/PostsPage.tsx admin/client/src/styles.css tests/admin-editorial-content-lists.test.ts
git commit -m "feat: restyle admin article list"
```

---

### Task 4: Convert the clipboard table and complete verification

**Files:**
- Modify: `admin/client/src/pages/ClipsPage.tsx:164-180`
- Modify: `admin/client/src/styles.css`
- Test: `tests/admin-editorial-content-lists.test.ts`

**Interfaces:**
- Consumes: shared `editorial-resource-*` CSS from Task 2, `clipLanguageLabel`, `formatDate`, and the existing `deleteClip` workflow.
- Produces: table-free clipboard rows with a separate protected delete control; completes all cross-page contracts.

- [ ] **Step 1: Replace the clipboard table renderer**

Replace the current `<section className="data-table-wrap">...</section>` with:

```tsx
        <section className="editorial-resource-list clip-resource-list" aria-label="剪切板列表">
          {data.items.map((clip) => (
            <article className="editorial-resource-row clip-resource-row" key={clip.slug}>
              <Link className="editorial-resource-link" to={`/clips/${encodeURIComponent(clip.slug)}`} aria-label={`打开剪切内容 ${clip.title}`}>
                <span className="editorial-resource-meta">
                  <span>{formatDate(clip.updatedAt)}</span>
                  <small>最近修改</small>
                </span>
                <span className="editorial-resource-main">
                  <strong className="editorial-resource-title">{clip.title}</strong>
                  <small className="editorial-resource-detail">{clip.file}</small>
                </span>
                <span className="editorial-resource-aside">
                  <span className="language-label">{clipLanguageLabel(clip.language)}</span>
                </span>
              </Link>
              <div className="editorial-resource-actions">
                <button className="danger-text clip-row-delete" type="button" aria-label={`删除 ${clip.title}`} disabled={deletingSlug === clip.slug} onClick={() => void deleteClip(clip.slug, clip.title)}>{deletingSlug === clip.slug ? '删除中…' : '删除'}</button>
              </div>
            </article>
          ))}
        </section>
```

- [ ] **Step 2: Protect and position the clipboard delete action**

Add to `styles.css`:

```css
.clip-resource-row { padding-right: 78px; }
.clip-resource-row .editorial-resource-link {
  grid-template-columns: minmax(128px, .38fr) minmax(220px, 1.5fr) minmax(100px, .45fr);
}
.editorial-resource-actions {
  position: absolute;
  z-index: 3;
  top: 50%;
  right: 18px;
  display: flex;
  align-items: center;
  transform: translateY(-50%);
}
.editorial-resource-actions .clip-row-delete:focus-visible {
  outline: 2px solid var(--red);
  outline-offset: 3px;
}
```

Inside `@media (max-width: 760px)`, add:

```css
  .clip-resource-row { padding-right: 0; }
  .clip-resource-row .editorial-resource-link {
    padding-bottom: 54px;
    grid-template-columns: 1fr;
  }
  .editorial-resource-actions {
    top: auto;
    right: 18px;
    bottom: 14px;
    transform: none;
  }
```

Inside `@media (prefers-reduced-motion: reduce)`, ensure `.editorial-resource-actions` is not accidentally affected by main-content transform rules; no additional animation is added to the delete button.

- [ ] **Step 3: Run the focused suite and confirm GREEN**

Run:

```powershell
npm test -- --run tests/admin-editorial-content-lists.test.ts tests/admin-dashboard-navigation.test.tsx tests/admin-client-source.test.ts tests/admin-client-visual.test.ts
```

Expected: all selected test files pass with zero failures.

- [ ] **Step 4: Build the admin client**

Run:

```powershell
npm run admin:build
```

Expected: Vite production build exits 0 and writes the admin bundle without TypeScript or bundling errors.

- [ ] **Step 5: Run repository verification required by AGENTS.md**

Run:

```powershell
npm test -- --run
npm run build
```

Expected: the full Vitest run reports zero failing tests; Astro validation and production generation exit 0.

- [ ] **Step 6: Inspect the final diff for unrelated changes**

Run:

```powershell
git diff -- admin/client/src/pages/DashboardPage.tsx admin/client/src/pages/PostsPage.tsx admin/client/src/pages/ClipsPage.tsx admin/client/src/styles.css admin/client/src/styles/theme.css tests/admin-editorial-content-lists.test.ts tests/admin-dashboard-navigation.test.tsx
git status --short
```

Expected: the feature diff contains only the editorial-list work. Existing unrelated modified and untracked files remain present but unstaged and unaltered by this task.

- [ ] **Step 7: Commit the clipboard conversion and final contracts**

```powershell
git add -- admin/client/src/pages/ClipsPage.tsx admin/client/src/styles.css tests/admin-editorial-content-lists.test.ts
git commit -m "feat: restyle admin clipboard list"
```

- [ ] **Step 8: Optional visual QA when the admin server is available**

Run the existing admin client/server development commands in separate terminals:

```powershell
npm run admin:server
npm run admin:dev
```

Verify at desktop and narrow viewport widths:

- each row receives the rose accent line, background wash, and title color on hover;
- keyboard focus produces the same row emphasis plus a visible outline;
- article and clipboard metadata do not overflow;
- the clipboard delete button remains independently clickable;
- light and dark themes both remain legible;
- reduced-motion mode removes translation without removing state indication.

Do not change server configuration or authentication data solely for visual QA.
