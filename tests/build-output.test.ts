import { access, readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const dist = (path: string) => new URL(`../dist/${path}`, import.meta.url);

describe('production build output', () => {
  it.each([
    'index.html',
    'posts/index.html',
    'posts/welcome/index.html',
    'tags/index.html',
    'archive/index.html',
    'about/index.html',
    '404.html',
    'rss.xml',
    'sitemap-index.xml',
  ])('generates %s', async (file) => {
    await expect(access(dist(file))).resolves.toBeUndefined();
  });

  it('adds canonical metadata to the home page', async () => {
    const html = await readFile(dist('index.html'), 'utf8');
    expect(html).toContain('rel="canonical"');
    expect(html).toContain('https://blog.reaier.top/');
  });

  it('includes the persistent motion shell in production HTML', async () => {
    for (const file of ['index.html', 'posts/markdown-guide/index.html']) {
      const html = await readFile(dist(file), 'utf8');
      expect(html).toContain('data-motion-shell');
      expect(html).toContain('data-fluid-canvas');
      expect(html).toContain('data-transition-veil');
      expect(html).toContain('data-reading-progress');
      expect(html).toContain('data-motion-status');
      expect(html).toContain('data-astro-transition-persist="motion-shell"');
    }
  });

  it('preserves straight apostrophes in Markdown prose', async () => {
    const html = await readFile(dist('posts/welcome/index.html'), 'utf8');
    expect(html).toContain("<strong>Aier's blogs</strong>");
    expect(html).not.toContain('<strong>Aier’s blogs</strong>');
  });
  it('renders Markdown math with KaTeX', async () => {
    const html = await readFile(dist('posts/markdown-guide/index.html'), 'utf8');
    expect(html).toContain('class="katex-display"');
    expect(html).toContain('∫');
  });
  it('renders the callout example in production HTML', async () => {
    const article = await readFile(dist('posts/markdown-guide/index.html'), 'utf8');
    expect(article).toContain('data-callout-card');
    expect(article).toContain('<details class="callout-card glass"');
    expect(article).not.toMatch(/<details[^>]*data-callout-card[^>]*\sopen(?:\s|>|=)/);
  });

  it('generates a noindex clip page, metadata-only card, and byte-identical raw download', async () => {
    const page = await readFile(dist('clips/astro-config/index.html'), 'utf8');
    const article = await readFile(dist('posts/markdown-guide/index.html'), 'utf8');
    const raw = await readFile(dist('clips/astro-config.txt'), 'utf8');
    const source = await readFile(new URL('../src/content/clips/astro.config.ts', import.meta.url), 'utf8');
    const sitemap = await readFile(dist('sitemap-0.xml'), 'utf8');

    expect(page).toContain('name="robots" content="noindex, nofollow"');
    expect(page).toContain('data-clip-detail');
    expect(page).toContain('astro.config.ts');
    expect(article).toContain('data-clip-card');
    expect(article).not.toContain("filter: (page) => !page.includes('/clips/')");
    expect(raw).toBe(source);
    expect(sitemap).not.toContain('/clips/');
  });
});
