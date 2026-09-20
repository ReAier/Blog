import { renderMermaidBlocks } from '../lib/mermaid-renderer';

let generation = 0;
let observer: MutationObserver | undefined;

function stop() {
  generation += 1;
  observer?.disconnect();
  observer = undefined;
}

function start() {
  stop();
  if (!document.querySelector('[data-mermaid]')) return;
  const render = () => {
    const current = ++generation;
    void renderMermaidBlocks(document, document.documentElement.dataset.theme ?? 'light', () => current === generation);
  };
  observer = new MutationObserver(render);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  render();
}

document.addEventListener('astro:before-swap', stop);
document.addEventListener('astro:page-load', start);
start();
