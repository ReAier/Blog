import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

describe('callout card integration', () => {
  it('registers the callout plugin in the Markdown pipeline', async () => {
    const config = await read('astro.config.ts');
    expect(config).toContain("import { remarkCalloutCards } from './src/lib/remark-callout-card'");
    expect(config).toContain('remarkPlugins: [remarkMath, remarkCalloutCards, remarkClipCards, remarkReferenceCards]');
  });

  it('defines responsive and accessible callout styles', async () => {
    const css = await read('src/styles/global.css');
    for (const token of [
      '.callout-card',
      '.callout-card__summary',
      '.callout-card__icon',
      '.callout-card__chevron',
      '.callout-card__content',
      '.callout-card:focus-within',
      '.callout-card[open]',
    ]) {
      expect(css).toContain(token);
    }
    expect(css).toMatch(/\.callout-card\s*\{[^}]*min-width:\s*0/);
    expect(css).toMatch(/\.callout-card__content\s*\{[^}]*overflow-wrap:\s*anywhere/);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*\.callout-card__chevron[\s\S]*transition:\s*none !important/);
  });

  it('documents the public Markdown format and validation rules', async () => {
    const readme = await read('README.md');
    const guide = await read('src/content/blog/markdown-guide.md');
    expect(readme).toContain('```callout');
    expect(readme).toContain('`title` 和正文均为必填');
    expect(readme).toContain('默认折叠');
    expect(guide).toContain('```callout');
    expect(guide).toContain('可折叠提示卡片');
  });
});