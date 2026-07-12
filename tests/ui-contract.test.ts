import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

describe('visual shell contract', () => {
  it('defines the required visual and accessibility primitives', async () => {
    const css = await read('src/styles/global.css');
    expect(css).toContain('--accent:');
    expect(css).toContain('backdrop-filter');
    expect(css).toContain(':focus-visible');
    expect(css).toContain('prefers-reduced-motion');
    expect(css).toContain('overflow-x: auto');
    expect(css).toContain('::view-transition-old(root)');
    expect(css).toContain('::view-transition-new(root)');
  });

  it('provides semantic shell landmarks and a skip link', async () => {
    const layout = await read('src/layouts/BaseLayout.astro');
    expect(layout).toContain('class="skip-link"');
    expect(layout).toContain('<main id="main-content"');
    expect(layout).toContain('<SiteHeader');
    expect(layout).toContain('<SiteFooter');
  });

  it('provides theme controls and all five labeled accent choices', async () => {
    const panel = await read('src/components/PreferencePanel.astro');
    expect(panel).toContain('aria-label="外观设置"');
    for (const accent of ['coral', 'teal', 'indigo', 'amber', 'rose']) {
      expect(panel).toContain(`data-accent="${accent}"`);
    }
  });
});
