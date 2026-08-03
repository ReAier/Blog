import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

describe('cloud clipboard UI contract', () => {
  it('renders Markdown clip references as metadata-only cards with deferred copying', async () => {
    const plugin = await read('src/lib/remark-clip-card.ts');
    const enhancer = await read('src/scripts/clip-copy.ts');
    expect(plugin).toContain('data-clip-card');
    expect(plugin).toContain('data-copy-clip');
    expect(plugin).toContain('clip.rawUrl');
    expect(plugin).not.toContain('clip.code');
    expect(enhancer).toContain('fetch(rawUrl)');
    expect(enhancer).toContain("setState('success'");
    expect(enhancer).toContain("setState('error'");
    expect(enhancer).toContain("setState('unsupported'");
  });

  it('keeps every blog source file in ordinary Markdown', async () => {
    const contentConfig = await read('src/content.config.ts');
    const guide = await read('src/content/blog/markdown-guide.md');
    const config = await read('astro.config.ts');
    const packageJson = await read('package.json');
    const sample = await read('src/content/clips/astro.config.ts');
    const docs = await read('docs/cloud-clipboard.md');

    expect(contentConfig).toContain("pattern: '**/*.md'");
    expect(guide.replace(/\r\n/g, '\n')).toContain('```clip\ntitle: Astro 配置示例');
    expect(guide).not.toContain('slug: astro-config');
    expect(guide).not.toContain('ClipCard');
    expect(guide).not.toContain('Markdown / MDX');
    expect(config).not.toContain('@astrojs/mdx');
    expect(packageJson).not.toContain('@astrojs/mdx');
    expect(sample).not.toContain('@astrojs/mdx');
    expect(docs).not.toContain('.mdx');
    expect(docs).not.toContain('<ClipCard');
    expect(docs).toContain('剪切板元数据直接写在');
    expect(docs).not.toContain('meta.json 示例');
  });

  it('provides responsive visual primitives for cards and detail pages', async () => {
    const css = await read('src/styles/global.css');
    for (const token of ['.clip-card', '.clip-card__actions', '.clip-detail', '.clip-code-shell']) {
      expect(css).toContain(token);
    }
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

  it('returns from clip details through browser history with a posts fallback', async () => {
    const detail = await read('src/pages/clips/[slug].astro');
    const backScript = await read('src/scripts/clip-back.ts');
    expect(detail).toContain('data-clip-back');
    expect(detail).toContain('href="/posts/"');
    expect(detail).toContain("import '../../scripts/clip-back'");
    expect(detail).not.toContain('href="/">返回博客</a>');
    expect(backScript).toContain('window.history.length > 1');
    expect(backScript).toContain('window.history.back()');
    expect(backScript).toContain('event.preventDefault()');
    expect(backScript).toContain("document.addEventListener('astro:page-load'");
  });

  it('registers the clip remark plugin and excludes clip pages from the sitemap', async () => {
    const config = await read('astro.config.ts');
    expect(config).toContain('remarkClipCards');
    expect(config).toContain('remarkPlugins: [remarkMath, remarkClipCards, remarkReferenceCards]');
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
