import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

describe('mobile page background', () => {
  it('uses the shared viewport-fixed layer instead of fixed background attachment', async () => {
    const css = await read('src/styles/global.css');
    const shell = await read('src/components/MotionShell.astro');

    expect(shell).toContain('data-page-background');
    expect(css).toMatch(/\.page-background\s*\{[^}]*position:\s*fixed;[^}]*inset:\s*0/s);
    expect(css).toContain('height: 100lvh;');
    expect(css).not.toContain('background-attachment: fixed;');
    expect(css).not.toContain('body { background-attachment: scroll; }');
  });
});
