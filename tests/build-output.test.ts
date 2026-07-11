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
    expect(html).toContain('http://blog.reaier.top/');
  });
});
