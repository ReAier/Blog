import { access, readFile, readdir } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const dist = (path: string) => new URL(`../dist/${path}`, import.meta.url);

async function generatedDirectories(path: string): Promise<string[]> {
  try {
    return (await readdir(dist(path), { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  } catch {
    return [];
  }
}

describe('production build output', () => {
  it.each([
    'index.html',
    'posts/index.html',
    'tags/index.html',
    'archive/index.html',
    'about/index.html',
    '404.html',
    'rss.xml',
    'sitemap-index.xml',
  ])('generates %s without requiring private content', async (file) => {
    await expect(access(dist(file))).resolves.toBeUndefined();
  });


  it('forces Astro to rebuild the content cache for production builds', async () => {
    const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.build).toContain('astro build --force');
  });
  it('adds canonical metadata to the home page', async () => {
    const html = await readFile(dist('index.html'), 'utf8');
    expect(html).toContain('rel="canonical"');
    expect(html).toContain('https://blog.reaier.top/');
  });

  it('includes the persistent motion shell on public static pages', async () => {
    for (const file of ['index.html', 'posts/index.html', 'about/index.html']) {
      const html = await readFile(dist(file), 'utf8');
      expect(html).toContain('data-motion-shell');
      expect(html).toContain('data-fluid-canvas');
      expect(html).toContain('data-transition-veil');
      expect(html).toContain('data-reading-progress');
      expect(html).toContain('data-motion-status');
      expect(html).toContain('data-astro-transition-persist="motion-shell"');
    }
  });

  it('applies the article layout to every locally generated post', async () => {
    const slugs = await generatedDirectories('posts/');
    for (const slug of slugs) {
      const html = await readFile(dist(`posts/${slug}/index.html`), 'utf8');
      expect(html).toContain('<article>');
      expect(html).toContain('class="article-header reading-container"');
      expect(html).toContain('data-motion-shell');
    }
  });

  it('keeps every locally generated clip out of the sitemap', async () => {
    const slugs = await generatedDirectories('clips/');
    const sitemap = await readFile(dist('sitemap-0.xml'), 'utf8');

    for (const slug of slugs) {
      const page = await readFile(dist(`clips/${slug}/index.html`), 'utf8');
      const raw = await readFile(dist(`clips/${slug}.txt`), 'utf8');
      expect(page).toContain('name="robots" content="noindex, nofollow"');
      expect(page).toContain('data-clip-detail');
      expect(raw.length).toBeGreaterThan(0);
      expect(sitemap).not.toContain(`/clips/${slug}/`);
    }
  });
});
