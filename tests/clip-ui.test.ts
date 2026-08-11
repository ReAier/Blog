import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

describe('cloud clipboard UI contract', () => {
  it('renders Markdown clip references as metadata-only new-tab links', async () => {
    const plugin = await read('src/lib/remark-clip-card.ts');
    expect(plugin).toContain('data-clip-card');
    expect(plugin).toContain('target="_blank"');
    expect(plugin).toContain('rel="noopener noreferrer"');
    expect(plugin).toContain('aria-hidden="true"');
    expect(plugin).not.toContain('clip-card__actions');
    expect(plugin).not.toContain('data-copy-clip');
    expect(plugin).not.toContain('clip.rawUrl');
    expect(plugin).not.toContain('clip.code');
  });

  it('keeps every blog source file in ordinary Markdown', async () => {
    const contentConfig = await read('src/content.config.ts');
    const guide = await read('docs/content-authoring.md');
    const config = await read('astro.config.ts');
    const packageJson = await read('package.json');
    const docs = await read('docs/cloud-clipboard.md');

    expect(contentConfig).toContain("pattern: '**/*.md'");
    expect(guide.replace(/\r\n/g, '\n')).toContain('```clip\ntitle: OAuth 回调处理');
    expect(guide).not.toContain('slug: astro-config');
    expect(guide).not.toContain('ClipCard');
    expect(guide).not.toContain('Markdown / MDX');
    expect(config).not.toContain('@astrojs/mdx');
    expect(packageJson).not.toContain('@astrojs/mdx');
    expect(docs).not.toContain('.mdx');
    expect(docs).not.toContain('<ClipCard');
    expect(docs).toContain('剪切板元数据直接写在');
    expect(docs).not.toContain('meta.json 示例');
  });

  it('provides responsive visual primitives for cards and detail pages', async () => {
    const css = await read('src/styles/global.css');
    for (const token of ['.clip-card', '.clip-detail', '.clip-detail__actions', '.clip-code-shell']) {
      expect(css).toContain(token);
    }
    expect(css).not.toContain('.clip-card__actions');
    expect(css).toMatch(/\.clip-card:hover[\s\S]*?border-color:\s*rgba\(var\(--accent-rgb\), \.4\)/);
    expect(css).toMatch(/\.clip-card:focus-within[\s\S]*?border-color:\s*rgba\(var\(--accent-rgb\), \.58\)/);
    expect(css).toMatch(/\.clip-card::after\s*\{[^}]*content:\s*"<\/>"/);
    expect(css).toMatch(/\.clip-card:hover,\s*\.problem-card:hover\s*\{[^}]*transform:\s*translateY\(-2px\)[^}]*box-shadow:\s*0 24px 64px rgba\(38, 35, 29, \.14\)/);
    expect(css).toMatch(/:root\[data-theme="dark"\] \.clip-card:hover,\s*:root\[data-theme="dark"\] \.problem-card:hover\s*\{[^}]*box-shadow:\s*0 26px 70px rgba\(0, 0, 0, \.4\)/);
    expect(css).not.toMatch(/\.clip-card::before\s*\{[^}]*border-radius:\s*50%/);
  });

  it('uses the article code-block glass material on clip detail pages', async () => {
    const css = await read('src/styles/global.css');
    expect(css).toMatch(/\.clip-code-shell\s*\{[^}]*background:\s*var\(--code-surface\)/);
    expect(css).toMatch(/\.clip-code-shell\s*\{[^}]*-webkit-backdrop-filter:\s*blur\(12px\) saturate\(120%\)/);
    expect(css).toMatch(/\.clip-code-shell\s*\{[^}]*backdrop-filter:\s*blur\(12px\) saturate\(120%\)/);
    expect(css).toMatch(/\.clip-code-shell\s*\{[^}]*box-shadow:\s*inset 0 1px rgba\(255, 255, 255, \.05\)/);
    expect(css).toMatch(/\.clip-code-shell pre\s*\{[^}]*background:\s*transparent !important/);
  });

  it('gives light-mode clip and reference cards translucent backdrop glass', async () => {
    const css = await read('src/styles/global.css');

    expect(css).toContain(':root:not([data-theme="dark"]) .clip-card,');
    expect(css).toContain(':root:not([data-theme="dark"]) .reference-card,');
    expect(css).toContain('background: linear-gradient(135deg, rgba(var(--accent-rgb), .07), transparent), var(--embedded-card-surface);');
    expect(css).toContain('backdrop-filter: blur(18px) saturate(135%);');
    expect(css).toContain('.glass.clip-card,');
    expect(css).toContain('.glass.reference-card,');
  });

  it('provides a noindex clip detail page and raw text route', async () => {
    const page = await read('src/pages/clips/[slug].astro');
    const rawRoute = await read('src/pages/clips/[slug].txt.ts');
    expect(page).toContain('robots="noindex, nofollow"');
    expect(page).toContain('data-clip-detail');
    expect(page).toContain('set:html={highlightedCode}');
    expect(rawRoute).toContain("'Content-Type': 'text/plain; charset=utf-8'");
    expect(rawRoute).toContain("'Content-Disposition': `attachment; filename=\"");
  });

  it('keeps copy and download actions without a return control', async () => {
    const detail = await read('src/pages/clips/[slug].astro');
    expect(detail).toContain('data-copy-clip');
    expect(detail).toContain('download={clip.file}');
    expect(detail).not.toContain('data-clip-back');
    expect(detail).not.toContain('href="/posts/"');
    expect(detail).not.toContain("import '../../scripts/clip-back'");
  });

  it('registers the clip remark plugin and excludes clip pages from the sitemap', async () => {
    const config = await read('astro.config.ts');
    expect(config).toContain('remarkClipCards');
    expect(config).toContain('remarkPlugins: [remarkMath, remarkCalloutCards, remarkClipCards, remarkReferenceCards, remarkProblemCards]');
    expect(config).toContain("!page.includes('/clips/')");
  });

  it('loads one shared copy enhancer for cards and detail pages', async () => {
    const layout = await read('src/layouts/BaseLayout.astro');
    const detail = await read('src/pages/clips/[slug].astro');
    expect(layout).toContain("import '../scripts/clip-copy'");
    expect(detail).not.toContain('function enhanceDetailCopy');
  });

  it('allows layouts to set robots metadata without changing normal pages', async () => {
    const layout = await read('src/layouts/BaseLayout.astro');
    const seo = await read('src/components/SeoHead.astro');
    expect(layout).toContain('robots?: string');
    expect(layout).toContain('<SeoHead {...props} />');
    expect(seo).toContain('robots?: string');
    expect(seo).toContain('<meta name="robots" content={robots} />');
  });
});
