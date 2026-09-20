// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import { remarkMermaid } from '../src/lib/remark-mermaid';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { remarkCalloutCards } from '../src/lib/remark-callout-card';
import { renderMermaidBlocks, renderMermaidPreview } from '../src/lib/mermaid-renderer';

const render = vi.fn(async (id: string, source: string) => {
  if (source === 'broken') throw new Error('invalid diagram');
  return { svg: `<svg id="${id}" xmlns="http://www.w3.org/2000/svg"><text>${source}</text></svg>` };
});
vi.mock('../src/lib/mermaid-loader', () => ({ loadMermaid: async () => ({ initialize: vi.fn(), render }) }));

function fixture(source = 'graph TD; A-->B') {
  const root = document.createElement('div');
  root.innerHTML = '<figure data-mermaid><pre data-mermaid-source><code></code></pre><div data-mermaid-output></div><p data-mermaid-error hidden></p></figure>';
  root.querySelector('code')!.textContent = source;
  return root;
}

describe('Mermaid Markdown and rendering', () => {
  it('preserves math nodes and renders Mermaid inside callouts', async () => {
    const processor = await createMarkdownProcessor({ remarkPlugins: [remarkMath, remarkCalloutCards, remarkMermaid], rehypePlugins: [rehypeKatex] });
    const result = await processor.render('$x^2$\n\n````callout\ntitle: Diagram\n\n```mermaid\ngraph TD; A-->B\n```\n````');
    expect(result.code).toContain('katex');
    expect(result.code).toContain('data-mermaid');
  });
  it('escapes source and preserves ordinary and nested example fences', async () => {
    const processor = await createMarkdownProcessor({ remarkPlugins: [remarkMermaid] });
    const { code } = await processor.render('```mermaid\ngraph TD; A["<script>alert(1)</script>"]\n```\n\n```js\nconst a = 1;\n```\n\n````markdown\n```mermaid\ngraph TD; A-->B\n```\n````');
    expect(code.match(/data-mermaid=""/g)).toHaveLength(1);
    const parsed = new DOMParser().parseFromString(code, 'text/html');
    expect(parsed.querySelector('[data-mermaid-source]')!.textContent).toContain('<script>alert(1)</script>');
    expect(parsed.querySelector('script')).toBeNull();
    expect(code).not.toContain('<script>');
    expect(code).toContain('const');
  });

  it('renders multiple diagrams with unique IDs and re-renders from source on theme changes', async () => {
    const root = fixture();
    root.append(fixture());
    await renderMermaidBlocks(root, 'light');
    const ids = [...root.querySelectorAll('svg')].map((svg) => svg.id);
    expect(new Set(ids).size).toBe(2);
    expect(root.querySelector('pre')!.hidden).toBe(true);
    await renderMermaidBlocks(root, 'dark');
    expect(root.querySelector('code')!.textContent).toBe('graph TD; A-->B');
    expect(root.querySelector('svg')!.id).not.toBe(ids[0]);
  });

  it('keeps failed source readable and still renders the next diagram', async () => {
    const root = fixture('broken');
    root.append(fixture());
    await renderMermaidBlocks(root, 'light');
    expect(root.querySelector('pre')!.hidden).toBe(false);
    expect(root.querySelector<HTMLElement>('[data-mermaid-error]')!.hidden).toBe(false);
    expect(root.querySelectorAll('svg')).toHaveLength(1);
  });

  it('does not commit stale work', async () => {
    const root = fixture();
    await renderMermaidBlocks(root, 'light', () => false);
    expect(root.querySelector('svg')).toBeNull();
  });

  it('drops in-flight stale results and serializes the next request', async () => {
    let finish!: (value: { svg: string }) => void;
    let started!: () => void;
    const start = new Promise<void>((resolve) => { started = resolve; });
    render.mockImplementationOnce(() => {
      started();
      return new Promise((resolve) => { finish = resolve; });
    });
    const oldRoot = fixture('old');
    let current = true;
    const oldJob = renderMermaidBlocks(oldRoot, 'light', () => current);
    await start;
    current = false;
    const newRoot = fixture('new');
    const newJob = renderMermaidBlocks(newRoot, 'dark');
    finish({ svg: '<svg><text>old</text></svg>' });
    await Promise.all([oldJob, newJob]);
    expect(oldRoot.querySelector('svg')).toBeNull();
    expect(newRoot.querySelector('svg')!.textContent).toBe('new');
    expect(document.querySelector('.mermaid-render-host')).toBeNull();
  });

  it('does not render when a page has no diagrams', async () => {
    const before = render.mock.calls.length;
    await renderMermaidBlocks(document.createElement('main'), 'light');
    expect(render.mock.calls).toHaveLength(before);
  });

  it('keeps admin preview script isolation and excludes source from code enhancement', async () => {
    const editor = await readFile('admin/client/src/pages/PostEditorPage.tsx', 'utf8');
    const enhancer = await readFile('src/components/CodeEnhancer.astro', 'utf8');
    expect(editor).toContain('sandbox=""');
    expect(editor).not.toContain('allow-scripts');
    expect(enhancer).toContain(':not([data-mermaid-source])');
  });

  it('renders an inert preview document and removes unsafe SVG content', async () => {
    render.mockResolvedValueOnce({ svg: '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(1)</script><text>safe</text></svg>' });
    const result = await renderMermaidPreview(`<!doctype html><html><body>${fixture().innerHTML}</body></html>`, 'light');
    expect(result).toContain('<svg');
    expect(result).not.toContain('onload');
    expect(result).not.toContain('<script');
    expect(result).toContain('safe');
  });
});
