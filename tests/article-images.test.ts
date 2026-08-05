import { access, readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const root = new URL('../', import.meta.url);

describe('article images', () => {
  it('styles only prose paragraph images as responsive article media', async () => {
    const css = await readFile(new URL('src/styles/global.css', root), 'utf8');
    expect(css).toContain('.prose > p > img,');
    expect(css).toContain('border-radius: 18px;');
    expect(css).toContain('box-shadow: var(--shadow);');
  });

  it('references a real local content image', async () => {
    const guide = await readFile(new URL('src/content/blog/markdown-guide.md', root), 'utf8');
    await expect(access(new URL('src/content/images/markdown-guide/build-result.webp', root))).resolves.toBeUndefined();
    expect(guide).toContain('![展示 Astro 构建结果](../images/markdown-guide/build-result.webp)');
  });
});
