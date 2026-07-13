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
  it('reinitializes page interactions after Astro swaps', async () => {
    const source = await read('src/scripts/motion-controller.ts');
    for (const token of [
      'initializeMotionPage',
      "astro:page-load",
      "astro:before-preparation",
      'AbortController',
      'IntersectionObserver',
      'data-reading-progress',
      'data-nav-indicator',
      'data-menu-trigger',
      'data-transition-veil',
      'aria-current',
      'isEnhancedNavigation',
      'currentHref',
    ]) {
      expect(source).toContain(token);
    }
  });

  it('keeps the canvas below content and the transition veil above it without blocking input', async () => {
    const css = await read('src/styles/global.css');
    expect(css).toContain('.fluid-canvas');
    expect(css).toContain('z-index: 0');
    expect(css).toContain('.transition-veil');
    expect(css).toContain('z-index: 70');
    expect(css).toContain('pointer-events: none');
  });
});

describe('page-specific motion coverage', () => {
  it('marks every page family for reveal without animating prose paragraphs individually', async () => {
    const files = [
      'src/pages/index.astro',
      'src/pages/posts/index.astro',
      'src/pages/tags/index.astro',
      'src/pages/tags/[tag].astro',
      'src/pages/archive.astro',
      'src/pages/about.astro',
      'src/pages/404.astro',
      'src/layouts/PostLayout.astro',
    ];
    for (const file of files) expect(await read(file)).toContain('data-reveal');

    const postLayout = await read('src/layouts/PostLayout.astro');
    expect(postLayout).toMatch(/class="prose"[^>]*data-reveal/);
    expect(postLayout).not.toMatch(/<p[^>]*data-reveal/);
  });

  it('caps reveal delays at 210ms and marks article regions semantically', async () => {
    const sources = await Promise.all([
      read('src/pages/index.astro'),
      read('src/pages/posts/index.astro'),
      read('src/pages/tags/index.astro'),
      read('src/pages/tags/[tag].astro'),
      read('src/pages/archive.astro'),
      read('src/pages/about.astro'),
      read('src/pages/404.astro'),
      read('src/layouts/PostLayout.astro'),
    ]);
    const joined = sources.join('\n');
    for (const delay of ['0ms', '70ms', '140ms', '210ms']) expect(joined).toContain(`--reveal-delay: ${delay}`);
    const delays = [...joined.matchAll(/--reveal-delay:\s*(\d+)ms/g)].map((match) => Number(match[1]));
    expect(Math.max(...delays)).toBeLessThanOrEqual(210);

    const layout = await read('src/layouts/PostLayout.astro');
    for (const token of ['article-header', 'article-layout', 'class="prose"', 'article-aside', 'article-footer']) {
      expect(layout).toContain(token);
    }
  });

  it('adds pointer-light cards and disables pointer behavior on hoverless devices', async () => {
    const card = await read('src/components/PostCard.astro');
    const home = await read('src/pages/index.astro');
    const controller = await read('src/scripts/motion-controller.ts');
    const css = await read('src/styles/global.css');

    expect(card).toContain('data-motion-card');
    expect(home).toContain('data-motion-card');
    for (const token of [
      "matchMedia('(hover: none)')",
      "querySelectorAll<HTMLElement>('[data-motion-card]')",
      "style.setProperty('--pointer-x'",
      "style.setProperty('--pointer-y'",
      "pointermove",
      "pointerleave",
    ]) expect(controller).toContain(token);
    expect(css).toContain('var(--pointer-x, 50%)');
    expect(css).toContain('var(--pointer-y, 50%)');
    expect(css).toContain('@media (hover: none)');
  });

  it('defines restrained hero, archive, menu, header, and common microinteractions', async () => {
    const css = await read('src/styles/global.css');
    for (const token of [
      'hero-sweep',
      'archive-item::before',
      '.site-nav[data-open="true"] a',
      'body[data-header-compact="true"] .nav-shell',
      '.text-link:hover',
      '.tag:active',
      '.post-card:active',
      'prefers-reduced-motion: reduce',
    ]) expect(css).toContain(token);
  });
});

describe('motion safety and accessibility', () => {
  it('fully disables the fluid canvas, transition veil, and reveal translation for reduced motion', async () => {
    const css = await read('src/styles/global.css');
    const reducedMotion = css.slice(css.lastIndexOf('@media (prefers-reduced-motion: reduce)'));

    expect(reducedMotion).toContain('.fluid-canvas,');
    expect(reducedMotion).toContain('.transition-veil');
    expect(reducedMotion).toContain('display: none !important');
    expect(reducedMotion).toContain('::view-transition-old(root),');
    expect(reducedMotion).toContain('::view-transition-new(root)');
    expect(reducedMotion).toContain('animation: none !important');
    expect(reducedMotion).toContain('[data-reveal]');
    expect(reducedMotion).toContain('.post-card[data-reveal]');
    expect(reducedMotion).toContain('transform: none !important');
    expect(reducedMotion).toContain('translate: none !important');
  });

  it('provides a static CSS background when WebGL falls back', async () => {
    const css = await read('src/styles/global.css');
    expect(css).toContain('.fluid-canvas[data-fluid-fallback="true"]');
    expect(css).toContain('radial-gradient');
    expect(css).toContain('background-color: transparent');
  });

  it('revealed state overrides the progressive enhancement hiding rule', async () => {
    const css = await read('src/styles/global.css');
    expect(css).toContain('html[data-motion-ready="true"] [data-reveal][data-revealed="true"]');
  });


  it('keeps RSS available without showing it in the top navigation', async () => {
    const config = await read('src/config.ts');
    const rss = await read('src/pages/rss.xml.ts');
    expect(config).not.toContain("{ label: 'RSS', href: '/rss.xml' }");
    expect(rss).toContain("from '@astrojs/rss'");
  });


  it('covers the full article card with the pointer gradient', async () => {
    const css = await read('src/styles/global.css');
    expect(css).toContain('ellipse 125% 150%');
    expect(css).not.toContain('width: 210px;');
    expect(css).not.toContain('translate(-35px, 35px)');
  });
});
