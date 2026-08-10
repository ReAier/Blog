import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

describe('cross-platform fixed background', () => {
  it('renders the selectable image on a dedicated stable viewport layer', async () => {
    const shell = await read('src/components/MotionShell.astro');
    const css = await read('src/styles/global.css');

    expect(shell).toContain('data-page-background');
    expect(css).toMatch(/\.page-background\s*\{[^}]*position:\s*fixed;[^}]*inset:\s*0;[^}]*z-index:\s*-\d+/s);
    expect(css).toContain('height: 100lvh;');
    expect(css).toMatch(/body\s*\{[^}]*isolation:\s*isolate;/s);
    expect(css).toContain('background-image: var(--backdrop-overlay), var(--page-background);');
    expect(css).not.toContain('background-attachment: fixed;');
  });

  it('resynchronizes the WebGL backing store when the visual viewport resizes', async () => {
    const source = await read('src/scripts/fluid-background.ts');

    expect(source).toContain('window.visualViewport');
    expect(source).toContain("addEventListener('resize', resize");
  });
});