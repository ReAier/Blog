import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

describe('reference card integration', () => {
  it('registers the reference plugin after the existing markdown plugins', async () => {
    const config = await read('astro.config.ts');
    expect(config).toContain("import { remarkReferenceCards } from './src/lib/remark-reference-card'");
    expect(config).toContain('remarkPlugins: [remarkMath, remarkManagedImages, remarkCalloutCards, remarkClipCards, remarkReferenceCards, remarkProblemCards]');
  });

  it('defines responsive, accessible reference-card styles', async () => {
    const css = await read('src/styles/global.css');
    for (const token of [
      '.reference-card',
      '.reference-card__source',
      '.reference-card__title',
      '.reference-card__description',
      '.reference-card:focus-within',
    ]) {
      expect(css).toContain(token);
    }
    expect(css).toMatch(/\.reference-card\s*\{[^}]*min-width:\s*0/);
    expect(css).toMatch(/\.reference-card__source\s*\{[^}]*overflow-wrap:\s*anywhere/);
    expect(css).not.toContain('.reference-card__action');
    expect(css).toMatch(/\.reference-card:hover[\s\S]*?border-color:\s*rgba\(var\(--accent-rgb\), \.4\)/);
    expect(css).toMatch(/\.reference-card:focus-within[\s\S]*?border-color:\s*rgba\(var\(--accent-rgb\), \.58\)/);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*\.reference-card:hover,[\s\S]*transform:\s*none !important/);
  });

  it('documents the public markdown format and validation rules', async () => {
    const readme = await read('README.md');
    const guide = await read('docs/content-authoring.md');
    expect(readme).toContain('```reference');
    expect(readme).toContain('仅支持绝对的 `http` 或 `https` URL');
    expect(guide).toContain('```reference');
    expect(guide).toContain('点击标题会在新标签页打开目标网页');
    expect(guide).not.toContain('点击“访问原文”');
  });
});
