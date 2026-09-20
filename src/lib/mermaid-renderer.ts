import { loadMermaid } from './mermaid-loader';

// Mermaid has global configuration: serialize renders across diagrams and themes.
let renderQueue: Promise<void> = Promise.resolve();
let nextId = 0;
const sessionId = Math.random().toString(36).slice(2);

export async function renderMermaidBlocks(
  root: ParentNode,
  theme: string,
  isCurrent: () => boolean = () => true,
): Promise<void> {
  const blocks = [...root.querySelectorAll<HTMLElement>('[data-mermaid]')];
  if (!blocks.length || !isCurrent()) return;

  const task = async () => {
    for (const block of blocks) {
      if (!isCurrent()) return;
      const source = block.querySelector<HTMLElement>('[data-mermaid-source]');
      const output = block.querySelector<HTMLElement>('[data-mermaid-output]');
      const error = block.querySelector<HTMLElement>('[data-mermaid-error]');
      if (!source || !output || !error) continue;
      const host = document.createElement('div');
      host.className = 'mermaid-render-host';
      host.setAttribute('aria-hidden', 'true');
      // A connected, invisible host allows SVG text measurement, including for srcDoc.
      Object.assign(host.style, { position: 'fixed', left: '-100000px', top: '0', visibility: 'hidden', width: '960px' });
      try {
        const [mermaid, { default: purifier }] = await Promise.all([
          loadMermaid(), import('dompurify'),
        ]);
        if (!isCurrent()) return;
        document.body.append(host);
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          theme: theme === 'dark' ? 'dark' : 'default',
          htmlLabels: false,
          flowchart: { htmlLabels: false },
          fontFamily: 'system-ui, sans-serif',
          suppressErrorRendering: true,
          maxTextSize: 50000,
          secure: ['secure', 'securityLevel', 'startOnLoad', 'maxTextSize', 'maxEdges', 'suppressErrorRendering', 'htmlLabels', 'flowchart', 'theme'],
        });
        const id = `mermaid-${sessionId}-${++nextId}`;
        const { svg } = await mermaid.render(id, source.textContent ?? '', host);
        if (!isCurrent()) return;
        output.innerHTML = purifier.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true } });
        const rendered = output.querySelector('svg');
        if (!rendered) throw new Error('Missing SVG');
        const width = Number(rendered.getAttribute('viewBox')?.split(/[\s,]+/)[2]);
        if (Number.isFinite(width) && width > 0) {
          rendered.style.width = `${width}px`;
          rendered.style.maxWidth = 'none';
        }
        rendered.setAttribute('role', 'img');
        if (!rendered.hasAttribute('aria-label') && !rendered.hasAttribute('aria-labelledby')) {
          rendered.setAttribute('aria-label', 'Mermaid 图表');
        }
        source.hidden = true;
        error.hidden = true;
      } catch {
        if (!isCurrent()) return;
        output.replaceChildren();
        source.hidden = false;
        error.textContent = '图表暂时无法渲染，请检查 Mermaid 语法或刷新重试。';
        error.hidden = false;
      } finally {
        host.remove();
      }
    }
  };
  const pending = renderQueue.then(task, task);
  renderQueue = pending.catch(() => {});
  await pending;
}

export async function renderMermaidPreview(
  html: string,
  theme: string,
  isCurrent: () => boolean = () => true,
): Promise<string> {
  // Parse inertly; never attach article HTML to the admin document.
  const preview = new DOMParser().parseFromString(html, 'text/html');
  await renderMermaidBlocks(preview, theme, isCurrent);
  return `<!doctype html>\n${preview.documentElement.outerHTML}`;
}
