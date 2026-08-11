import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const root = new URL('../', import.meta.url);
const read = (path: string) => readFile(new URL(path, root), 'utf8');

describe('theme contrast', () => {
  it('shares light and dark Shiki themes across article and clip rendering', async () => {
    const shared = await read('src/lib/syntax-highlighting.ts');
    const config = await read('astro.config.ts');
    const clips = await read('src/lib/clip-highlight.ts');

    expect(shared).toContain("light: 'github-light'");
    expect(shared).toContain("dark: 'github-dark'");
    expect(shared).toContain('defaultColor: false');
    expect(config).toContain("import { SHIKI_CONFIG } from './src/lib/syntax-highlighting'");
    expect(config).toContain('shikiConfig: SHIKI_CONFIG');
    expect(clips).toContain("import { SHIKI_CONFIG } from './syntax-highlighting'");
    expect(clips).toContain('shikiConfig: SHIKI_CONFIG');
  });

  it('selects Shiki token colors from the resolved site theme', async () => {
    const css = await read('src/styles/global.css');

    expect(css).toContain(':root[data-theme="light"] .astro-code');
    expect(css).toContain('color: var(--shiki-light)');
    expect(css).toContain(':root[data-theme="dark"] .astro-code');
    expect(css).toContain('color: var(--shiki-dark)');
  });

  it('builds dual-theme token variables for articles and clip pages', async () => {
    const article = await read('dist/posts/bitdp/index.html');
    const clip = await read('dist/clips/abc041d/index.html');

    for (const html of [article, clip]) {
      expect(html).toContain('--shiki-light');
      expect(html).toContain('--shiki-dark');
      expect(html).toContain('github-light');
      expect(html).toContain('github-dark');
    }
  });
  it('uses adaptive opacity for every card watermark family', async () => {
    const css = await read('src/styles/global.css');

    expect(css).toContain('--card-watermark-opacity: .15;');
    expect(css).toContain('--card-watermark-opacity: .09;');
    expect(css).toContain('--card-watermark-opacity: .13;');
    expect(css).toContain('--card-watermark-opacity: .075;');
    expect(css).toMatch(/\.clip-card::after\s*\{[^}]*opacity:\s*var\(--card-watermark-opacity\)/s);
    expect(css).toMatch(/\.reference-card::after\s*\{[^}]*opacity:\s*var\(--card-watermark-opacity\)/s);
    expect(css).toMatch(/\.problem-card__watermark\s*\{[^}]*opacity:\s*var\(--card-watermark-opacity\)/s);
  });
});
