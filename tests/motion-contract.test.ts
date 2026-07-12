import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

describe('motion shell', () => {
  it('mounts the Astro router and persistent motion shell', async () => {
    const layout = await read('src/layouts/BaseLayout.astro');
    expect(layout).toContain("from 'astro:transitions'");
    expect(layout).toContain('<ClientRouter');
    expect(layout).toContain('<MotionShell');
    expect(layout).toContain('data-page-kind');
  });

  it('provides persistent, accessible motion layers', async () => {
    const shell = await read('src/components/MotionShell.astro');
    for (const token of [
      'data-fluid-canvas',
      'data-transition-veil',
      'data-reading-progress',
      'data-motion-status',
      'aria-live="polite"',
      'transition:persist',
    ]) {
      expect(shell).toContain(token);
    }
  });
});
