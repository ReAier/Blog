import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const root = new URL('../', import.meta.url);

const readCss = () => readFile(new URL('src/styles/global.css', root), 'utf8');

describe('post list glass surface', () => {
  it('uses one clipped backdrop-blurred panel for every shared post list', async () => {
    const css = await readCss();

    expect(css).toMatch(/\.post-list\s*\{[^}]*overflow:\s*hidden[^}]*border:\s*1px solid var\(--line\)[^}]*border-radius:\s*20px[^}]*background:\s*var\(--post-list-surface\)[^}]*backdrop-filter:\s*blur\(16px\) saturate\(125%\)/s);
    expect(css).toMatch(/\.post-list-item:last-child\s*\{[^}]*border-bottom:\s*0/s);
    expect(css).toMatch(/\.post-list-item__link\s*\{[^}]*margin-inline:\s*0[^}]*padding:\s*28px 22px/s);
  });

  it('defines theme-aware tokens plus mobile and unsupported-browser fallbacks', async () => {
    const css = await readCss();

    expect(css).toContain('--post-list-surface: rgba(255, 254, 250, .46);');
    expect(css).toContain('--post-list-surface: rgba(16, 18, 20, .48);');
    expect(css).toMatch(/@media \(max-width: 760px\)[\s\S]*?\.post-list\s*\{[^}]*border-radius:\s*16px[^}]*backdrop-filter:\s*blur\(12px\) saturate\(120%\)/);
    expect(css).toMatch(/@supports not \(\(backdrop-filter: blur\(1px\)\) or \(-webkit-backdrop-filter: blur\(1px\)\)\)[\s\S]*?\.post-list\s*\{[^}]*background:\s*var\(--post-list-surface-fallback\)/);
  });
});
