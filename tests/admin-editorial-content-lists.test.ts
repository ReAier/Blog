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

  it('places the featured mark between article dates and title content', async () => {
    const posts = await readAdmin('pages/PostsPage.tsx');

    expect(posts).toMatch(/className="editorial-resource-meta"[\s\S]*?<\/span>\s*<span className="editorial-resource-featured"[\s\S]*?post\.featured[\s\S]*?首页精选[\s\S]*?<\/span>\s*<span className="editorial-resource-main"/);
    expect(posts).not.toMatch(/className="editorial-resource-aside"[\s\S]*?post\.featured/);
  });

  it('uses rounded frosted glass for status, search, and tag filters', async () => {
    const [dashboard, styles] = await Promise.all([
      readAdmin('pages/DashboardPage.tsx'),
      readAdmin('styles.css'),
    ]);

    expect(dashboard).toContain('className="recent-posts-card"');
    expect(styles).toMatch(/\.recent-posts-card \.card-heading\s*\{[^}]*border-bottom:\s*0/s);
    expect(styles).toMatch(/\.filter-tabs\s*\{[^}]*border-radius:\s*14px[^}]*background:\s*var\(--article-glass-surface\)[^}]*backdrop-filter:\s*blur\(12px\) saturate\(var\(--article-glass-saturation\)\)/s);
    expect(styles).toMatch(/\.filter-tabs button[^}]*border-radius:\s*11px/s);
    expect(styles).toMatch(/\.search-field\s*\{[^}]*border-radius:\s*14px[^}]*background:\s*var\(--article-glass-surface\)[^}]*backdrop-filter:\s*blur\(12px\) saturate\(var\(--article-glass-saturation\)\)/s);
    expect(styles).toMatch(/\.search-field input\s*\{[^}]*border:\s*0/s);
    expect(styles).toMatch(/\.tag-filter-control\s*>\s*\.secondary-button\s*\{[^}]*border-radius:\s*14px[^}]*background:\s*var\(--article-glass-surface\)[^}]*backdrop-filter:\s*blur\(12px\) saturate\(var\(--article-glass-saturation\)\)/s);
    expect(styles).toMatch(/\.tag-filter-popover\s*\{[^}]*border-radius:\s*20px[^}]*background:\s*var\(--article-glass-surface\)[^}]*backdrop-filter:\s*blur\(var\(--article-glass-blur\)\) saturate\(var\(--article-glass-saturation\)\)/s);
    expect(styles).toMatch(/\.blog-select__trigger\s*\{[^}]*border-radius:\s*14px[^}]*background:\s*var\(--article-glass-surface\)/s);
    expect(styles).toMatch(/\.blog-select__menu\s*\{[^}]*border-radius:\s*18px[^}]*background:\s*var\(--article-glass-surface\)[^}]*backdrop-filter:\s*blur\(var\(--article-glass-blur\)\) saturate\(var\(--article-glass-saturation\)\)/s);
    expect(styles).toMatch(/\.image-filter-toolbar\s*\{[^}]*background:\s*transparent[^}]*border:\s*0[^}]*backdrop-filter:\s*none/s);
    expect(styles).toMatch(/\.image-card footer \.image-card-action\s*\{[^}]*border-radius:\s*999px[^}]*backdrop-filter:\s*blur\(12px\)/s);
    expect(styles).toMatch(/\.settings-trigger\s*\{[^}]*background:\s*var\(--article-glass-surface\)[^}]*backdrop-filter:\s*blur\(12px\)/s);
    expect(styles).toMatch(/\.settings-menu\s*\{[^}]*background:\s*var\(--article-glass-surface\)[^}]*backdrop-filter:\s*blur\(var\(--article-glass-blur\)\)/s);
  });
  it('keeps clipboard deletion outside the editor link', async () => {
    const clips = await readAdmin('pages/ClipsPage.tsx');

    expect(clips).toMatch(/<article className="editorial-resource-row clip-resource-row"[\s\S]*?<Link className="editorial-resource-link"[\s\S]*?<\/Link>[\s\S]*?<div className="editorial-resource-actions">[\s\S]*?clip-row-delete/);
    expect(clips).toContain('aria-label={`删除 ${clip.title}`}');
  });

  it('keeps the public post-list frosted glass material', async () => {
    const styles = await readAdmin('styles.css');

    expect(styles).toMatch(/\.editorial-resource-list\s*\{[^}]*background:\s*var\(--article-glass-surface\)[^}]*box-shadow:\s*inset 0 1px rgba\(255, 255, 255, \.06\), var\(--article-glass-shadow\)[^}]*-webkit-backdrop-filter:\s*blur\(var\(--article-glass-blur\)\) saturate\(var\(--article-glass-saturation\)\)[^}]*backdrop-filter:\s*blur\(var\(--article-glass-blur\)\) saturate\(var\(--article-glass-saturation\)\)/s);
    expect(styles).toMatch(/@supports not \(\(backdrop-filter:\s*blur\(1px\)\) or \(-webkit-backdrop-filter:\s*blur\(1px\)\)\)[\s\S]*\.editorial-resource-list\s*\{[^}]*background:\s*var\(--article-glass-surface-fallback\)/s);
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
