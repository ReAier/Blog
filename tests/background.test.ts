import { access, readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const root = new URL('../', import.meta.url);

describe('shared photographic background', () => {
  it('ships an optimized background asset', async () => {
    await expect(access(new URL('public/site-background.webp', root))).resolves.toBeUndefined();
  });

  it('uses the same image in both themes with neutral overlays', async () => {
    const css = await readFile(new URL('src/styles/global.css', root), 'utf8');
    expect(css).toContain("--page-background: url('/site-background.webp')");
    expect(css).toContain('--backdrop-overlay:');
    expect(css).toContain(':root[data-theme="dark"]');
    expect(css).toContain('background-image: var(--backdrop-overlay), var(--page-background)');
  });
});
