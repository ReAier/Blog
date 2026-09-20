// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { renderMermaidPreview } from '../src/lib/mermaid-renderer';

vi.mock('../src/lib/mermaid-loader', () => ({
  loadMermaid: async () => (await vi.importActual<{ default: import('mermaid').Mermaid }>('mermaid/dist/mermaid.esm.min.mjs')).default,
}));

// jsdom has no layout engine. Supply text geometry only; visual layout is checked manually.
Object.defineProperty(SVGElement.prototype, 'getBBox', {
  configurable: true,
  value() { return { x: 0, y: 0, width: (this.textContent?.length || 1) * 8, height: 20 }; },
});
Object.defineProperty(SVGElement.prototype, 'getComputedTextLength', {
  configurable: true,
  value() { return (this.textContent?.length || 1) * 8; },
});

describe('installed Mermaid runtime', () => {
  it('renders Chinese flowcharts and sequence diagrams through the production renderer', async () => {
    const sources = [
      'flowchart TD\n A[开始写作] --> B{预览满意吗？}\n B -->|确认| C[发布]',
      'sequenceDiagram\n participant A as 作者\n participant B as 后台\n A->>B: 保存文章\n B-->>A: 即时预览',
    ];
    const doc = document.implementation.createHTMLDocument();
    for (const source of sources) {
      const figure = doc.createElement('figure');
      figure.setAttribute('data-mermaid', '');
      figure.innerHTML = '<pre data-mermaid-source><code></code></pre><div data-mermaid-output></div><p data-mermaid-error hidden></p>';
      figure.querySelector('code')!.textContent = source;
      doc.body.append(figure);
    }
    for (const theme of ['light', 'dark']) {
      const result = new DOMParser().parseFromString(await renderMermaidPreview(doc.documentElement.outerHTML, theme), 'text/html');
      expect(result.querySelectorAll('[data-mermaid-output] svg')).toHaveLength(2);
      expect([...result.querySelectorAll<HTMLElement>('[data-mermaid-source]')].every((source) => source.hidden)).toBe(true);
      expect(result.querySelector('script, foreignObject')).toBeNull();
    }
  }, 20000);
});
