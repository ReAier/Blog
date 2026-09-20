import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, posix } from 'node:path';
import { describe, expect, it } from 'vitest';
import { copyMermaidAssets, readMermaidAssets, serveMermaidAssets } from '../src/lib/mermaid-assets';
import { mermaidAssetBase } from '../src/lib/mermaid-loader';

describe('self-hosted Mermaid assets', () => {
  it('ships the entire upstream module graph with .js references and its license', async () => {
    const assets = await readMermaidAssets();
    expect(assets.has('mermaid.esm.min.js')).toBe(true);
    expect(assets.has('LICENSE')).toBe(true);
    expect(assets.size).toBeGreaterThan(10);
    for (const [file, source] of assets) {
      if (!file.endsWith('.js')) continue;
      for (const match of source.matchAll(/\b(?:from|import\s*\(?)\s*["'](\.[^"']+\.(?:mjs|js))["']/g)) {
        expect(match[1].endsWith('.js'), `${file}: ${match[1]}`).toBe(true);
        expect(assets.has(posix.normalize(posix.join(posix.dirname(file), match[1]))), `${file}: ${match[1]}`).toBe(true);
      }
    }
    const output = await mkdtemp(join(tmpdir(), 'mermaid-assets-'));
    try {
      await copyMermaidAssets(output);
      expect(await readFile(join(output, mermaidAssetBase, 'mermaid.esm.min.js'), 'utf8')).toBe(assets.get('mermaid.esm.min.js'));
    } finally {
      await rm(output, { recursive: true, force: true });
    }
  });

  it('serves only known dev assets with a JavaScript MIME type', async () => {
    let handler: Parameters<Parameters<typeof serveMermaidAssets>[0]['use']>[0];
    await serveMermaidAssets({ use(value) { handler = value; } });
    const headers = new Map();
    let body = '';
    const response = { statusCode: 200, setHeader(key: string, value: string) { headers.set(key, value); }, end(value = '') { body = value; } };
    handler!({ url: `${mermaidAssetBase}mermaid.esm.min.js` } as never, response as never, () => {});
    expect(headers.get('Content-Type')).toContain('text/javascript');
    expect(body).toContain('import');
    handler!({ url: `${mermaidAssetBase}missing.js` } as never, response as never, () => {});
    expect(response.statusCode).toBe(404);
  });
});
