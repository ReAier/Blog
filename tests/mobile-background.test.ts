import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

describe('mobile page background', () => {
  it('uses a stable large-viewport layer when mobile browser chrome changes height', async () => {
    const [layout, css] = await Promise.all([
      read('src/layouts/BaseLayout.astro'),
      read('src/styles/global.css'),
    ]);
    const mobileStyles = css.slice(css.indexOf('@media (max-width: 560px)'));

    expect(layout).toContain('class="page-background"');
    expect(css).toMatch(/\.page-background\s*\{[^}]*display:\s*none;/);
    expect(mobileStyles).toMatch(/\.page-background\s*\{[^}]*display:\s*block;[^}]*position:\s*fixed;[^}]*height:\s*100lvh;[^}]*background-image:\s*var\(--backdrop-overlay\),\s*var\(--page-background\);/s);
    expect(mobileStyles).toMatch(/body\s*\{[^}]*background-image:\s*none;[^}]*background-attachment:\s*scroll;/s);
    expect(mobileStyles).toMatch(/\.page-background\s*\{[^}]*transform:\s*translate3d\(0,\s*0,\s*0\);[^}]*backface-visibility:\s*hidden;[^}]*will-change:\s*transform;[^}]*contain:\s*paint;/s);
    expect(mobileStyles).not.toContain('body { background-attachment: fixed; }');
  });
});
