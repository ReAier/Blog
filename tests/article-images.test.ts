import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const root = new URL('../', import.meta.url);

describe('article images', () => {
  it('styles only prose paragraph images as responsive article media', async () => {
    const css = await readFile(new URL('src/styles/global.css', root), 'utf8');
    expect(css).toContain('.prose > p > img,');
    expect(css).toContain('border-radius: 18px;');
    expect(css).toContain('box-shadow: var(--shadow);');
  });

  it('documents local article image paths without requiring a tracked asset', async () => {
    const guide = await readFile(new URL('docs/content-authoring.md', root), 'utf8');
    expect(guide).toContain('src/content/images/');
    expect(guide).toContain('内容仅保存在本机');
  });
});