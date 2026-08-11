import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

describe('problem card integration', () => {
  it('forces a fresh content cache when starting the development server', async () => {
    const packageJson = JSON.parse(await read('package.json')) as { scripts?: Record<string, string> };
    expect(packageJson.scripts?.dev).toBe('astro dev --force');
  });

  it('registers the problem card remark plugin', async () => {
    const config = await read('astro.config.ts');
    expect(config).toContain("import { remarkProblemCards } from './src/lib/remark-problem-card'");
    expect(config).toContain('remarkPlugins: [remarkMath, remarkCalloutCards, remarkClipCards, remarkReferenceCards, remarkProblemCards]');
  });

  it('defines all difficulty rails and responsive problem card interactions', async () => {
    const css = await read('src/styles/global.css');

    for (const difficulty of ['red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'black']) {
      expect(css).toContain(`.problem-card[data-difficulty="${difficulty}"]`);
    }
    expect(css).toMatch(/\.problem-card\s*\{[^}]*padding:\s*clamp\(18px, 2\.4vw, 22px\)/);
    expect(css).not.toMatch(/\.problem-card\s*\{[^}]*border-color:\s*rgba\(var\(--accent-rgb\), \.5\)/);
    expect(css).toMatch(/\.problem-card:hover[\s\S]*?border-color:\s*rgba\(var\(--accent-rgb\), \.4\)/);
    expect(css).toMatch(/\.problem-card:focus-within[\s\S]*?border-color:\s*rgba\(var\(--accent-rgb\), \.58\)/);
    expect(css).toMatch(/\.problem-card::before\s*\{[^}]*background:\s*linear-gradient\(180deg, var\(--problem-difficulty\)/);
    expect(css).not.toMatch(/\.problem-card::after\s*\{[^}]*clip-path:\s*polygon/);
    expect(css).toMatch(/\.problem-card::after\s*\{[^}]*right:\s*-118px[^}]*top:\s*-126px/);
    expect(css).not.toContain('.problem-card__difficulty-dot');
    expect(css).not.toContain('.problem-card__links');
    expect(css).not.toContain('.problem-card__action');
    expect(css).toMatch(/\.problem-card__platform\s*\{[^}]*font-family:\s*var\(--mono\)/);
    expect(css).not.toContain('.problem-card__code');
    expect(css).not.toContain('.problem-card__meta');
    expect(css).toMatch(/\.problem-card__watermark\s*\{[^}]*position:\s*absolute[^}]*right:[^}]*font-family:\s*var\(--mono\)[^}]*font-size:\s*clamp\(4rem, 11vw, 7rem\)[^}]*opacity:\s*\.075/);
    expect(css).toMatch(/\.prose \.problem-card__categories,[\s\S]*?margin:\s*8px 0 0/);
    expect(css).toMatch(/\.prose \.problem-card__title,[\s\S]*?margin:\s*10px 0 0[^}]*font-size:\s*clamp\(1\.3rem, 2\.8vw, 1\.65rem\)/);
    expect(css).toMatch(/\.problem-card__title-link:hover\s*\{[^}]*color:\s*var\(--accent\)/);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.problem-card:hover/);
  });

  it('uses card-local dark transparency and frosted code surfaces', async () => {
    const css = await read('src/styles/global.css');

    expect(css).toContain('--embedded-card-surface: rgba(255, 254, 250, .62);');
    expect(css).toContain('--embedded-card-surface: rgba(20, 22, 24, .62);');
    expect(css).toMatch(/:root\[data-theme="dark"\]\s+\.clip-card,[\s\S]*?\.problem-card\s*\{[^}]*background:[^;}]*var\(--embedded-card-surface\)/);
    expect(css).toContain('--code-surface: rgba(255, 254, 250, .62);');
    expect(css).toContain('--code-surface: rgba(18, 20, 22, .66);');
    expect(css).toMatch(/\.prose pre\s*\{[^}]*background:\s*var\(--code-surface\)\s*!important[^}]*backdrop-filter:\s*blur\(12px\) saturate\(120%\)/);
    expect(css).toMatch(/@supports not \(\(backdrop-filter:[\s\S]*?\.prose pre,[\s\S]*?\.clip-code-shell\s*\{[^}]*background:\s*var\(--code-surface-fallback\)\s*!important/);
  });

  it('documents the problem fence and all supported difficulties', async () => {
    const guide = await read('docs/content-authoring.md');
    expect(guide).toContain('```problem');
    expect(guide).toMatch(/```problem[\s\S]*?title:\s*\S+[\s\S]*?url:\s*https?:\/\/\S+[\s\S]*?difficulty:\s*\S+[\s\S]*?categories:\s*\S+[\s\S]*?```/);
    for (const difficulty of ['red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'black']) {
      expect(guide).toContain(`\`${difficulty}\``);
    }
  });
});
