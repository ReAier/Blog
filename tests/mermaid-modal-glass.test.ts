import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

function rule(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`);
  expect(start, `Missing rule: ${selector}`).toBeGreaterThanOrEqual(0);
  const open = css.indexOf('{', start);
  return css.slice(open + 1, css.indexOf('}', open));
}

function expectSharedGlass(body: string): void {
  expect(body).toContain('background: var(--article-glass-surface);');
  expect(body).toContain('-webkit-backdrop-filter: blur(var(--article-glass-blur)) saturate(var(--article-glass-saturation));');
  expect(body).toContain('backdrop-filter: blur(var(--article-glass-blur)) saturate(var(--article-glass-saturation));');
  expect(body).toContain('var(--article-glass-shadow);');
}

describe('Mermaid and modal shared glass', () => {
  it('uses the established material for the Mermaid figure without changing its geometry', async () => {
    const css = await read('src/styles/global.css');
    const figure = rule(css, '.prose .mermaid-figure');
    expectSharedGlass(figure);
    expect(figure).toContain('padding: clamp(12px, 2vw, 24px);');
    expect(figure).toContain('border-radius: 16px;');
    expect(rule(css, '.mermaid-output')).toContain('overflow-x: auto;');
  });

  it('keeps only the SVG canvas transparent, not diagram nodes or labels', async () => {
    const css = await read('src/styles/global.css');
    expect(rule(css, '.mermaid-output > svg')).toContain('background: transparent !important;');
    expect(css).not.toMatch(/\.mermaid-output[^{}]*\b(?:rect|text|path)\b[^{}]*\{[^}]*fill:\s*transparent/);
  });

  it('provides a Mermaid fallback when neither backdrop-filter implementation is supported', async () => {
    const css = await read('src/styles/global.css');
    expect(css).toMatch(/@supports not \(\(backdrop-filter: blur\(1px\)\) or \(-webkit-backdrop-filter: blur\(1px\)\)\)\s*\{\s*\.prose \.mermaid-figure\s*\{\s*background: var\(--article-glass-surface-fallback\);/);
  });

  it('uses the same modal shadow and material without adding an independent dark shadow', async () => {
    const css = await read('admin/client/src/styles.css');
    const shared = css.slice(css.indexOf('/* Dialog system: clear glass sheets */'));
    expectSharedGlass(rule(shared, '.picker-dialog'));
    expect(rule(shared, '.picker-dialog')).not.toContain('0 28px 80px');
  });

  it('fades the scrim color instead of isolating the child glass with ancestor opacity', async () => {
    const css = await read('admin/client/src/styles.css');
    const shared = css.slice(css.indexOf('/* Dialog system: clear glass sheets */'));
    const frames = shared.slice(shared.indexOf('@keyframes dialog-scrim-in'), shared.indexOf('@keyframes dialog-sheet-in'));
    expect(frames).not.toMatch(/\bopacity\s*:/);
    expect(frames).toContain('from { background-color: rgba(5, 7, 9, 0); }');
    expect(frames).toContain('to { background-color: rgba(5, 7, 9, .28); }');
    const scrim = rule(shared, '.dialog-scrim');
    expect(scrim).toContain('backdrop-filter: none;');
    expect(scrim).not.toMatch(/(?:opacity|will-change|filter)\s*:\s*(?:0|opacity|blur)/);
    expect(shared).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*\.picker-dialog \{ animation: none; \}/);
  });
});
