import type { AstroIntegration } from 'astro';
import { fileURLToPath } from 'node:url';
import { copyMermaidAssets, serveMermaidAssets } from '../lib/mermaid-assets';

export function mermaidIntegration(): AstroIntegration {
  return {
    name: 'aier-mermaid-assets',
    hooks: {
      'astro:server:setup': async ({ server }) => { await serveMermaidAssets(server.middlewares); },
      'astro:build:done': async ({ dir }) => { await copyMermaidAssets(fileURLToPath(dir)); },
    },
  };
}
