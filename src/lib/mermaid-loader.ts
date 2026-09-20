import mermaidPackage from 'mermaid/package.json' with { type: 'json' };
import type { Mermaid } from 'mermaid';

export const mermaidAssetBase = `/_mermaid/${mermaidPackage.version}/`;

export async function loadMermaid(): Promise<Mermaid> {
  // Ship the upstream ESM bundle as static assets; don't rebuild every diagram engine.
  const url = `${mermaidAssetBase}mermaid.esm.min.js`;
  const module = await import(/* @vite-ignore */ url) as { default: Mermaid };
  return module.default;
}
