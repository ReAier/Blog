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

  it('initializes the persistent fluid background only once', async () => {
    const shell = await read('src/components/MotionShell.astro');
    for (const token of [
      "import { startFluidBackground } from '../scripts/fluid-background'",
      'window.__aierFluidCleanup',
      'startFluidBackground(canvas)',
    ]) {
      expect(shell).toContain(token);
    }

    const env = await read('src/env.d.ts');
    expect(env).toContain('__aierFluidCleanup?: () => void');
  });

  it('implements pausable WebGL with adaptive fallback and lifecycle synchronization', async () => {
    const source = await read('src/scripts/fluid-background.ts');
    for (const token of [
      "canvas.getContext('webgl'",
      "document.visibilityState === 'hidden'",
      'prefers-reduced-motion',
      'webglcontextlost',
      'webglcontextrestored',
      'requestAnimationFrame',
      'cancelAnimationFrame',
      'ResizeObserver',
      "window.addEventListener('aier:preference-change'",
      "document.addEventListener('aier:preference-change'",
      "astro:page-load",
      'resolvePageKind',
      'resolveMotionProfile',
      'createFrameGate',
      'data-fluid-fallback',
      'data-page-kind',
      'deleteProgram',
      'deleteBuffer',
    ]) {
      expect(source).toContain(token);
    }
  });

  it('uses mobile motion limits and responds to theme and accent changes', async () => {
    const source = await read('src/scripts/fluid-background.ts');
    expect(source).toContain("matchMedia('(max-width: 720px)')");
    expect(source).toContain("matchMedia('(prefers-reduced-motion: reduce)')");
    expect(source).toContain("matchMedia('(prefers-color-scheme: dark)')");
    expect(source).toContain('profile.dpr');
    expect(source).toContain('createFrameGate(profile.fps)');
    expect(source).toContain("getPropertyValue('--accent-rgb')");
  });
});
