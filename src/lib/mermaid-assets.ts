import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { mermaidAssetBase } from './mermaid-loader';

const require = createRequire(import.meta.url);
const dist = dirname(require.resolve('mermaid/dist/mermaid.esm.min.mjs'));
const chunks = 'chunks/mermaid.esm.min';
type Middleware = (request: IncomingMessage, response: ServerResponse, next: (error?: unknown) => void) => void;

export async function readMermaidAssets(): Promise<Map<string, string>> {
  const files = ['mermaid.esm.min.mjs', ...(await readdir(join(dist, chunks)))
    .filter((name) => name.endsWith('.mjs')).map((name) => `${chunks}/${name}`)];
  const assets = new Map<string, string>();
  for (const file of files) {
    const source = await readFile(join(dist, file), 'utf8');
    // .js works with existing static-host MIME tables, including older Nginx versions.
    assets.set(file.replace(/\.mjs$/, '.js'), source.replace(/\.mjs(?=["'])/g, '.js'));
  }
  assets.set('LICENSE', await readFile(join(dist, '../LICENSE'), 'utf8'));
  return assets;
}

export async function copyMermaidAssets(outputRoot: string): Promise<void> {
  const root = join(outputRoot, mermaidAssetBase.slice(1));
  for (const [file, source] of await readMermaidAssets()) {
    const target = join(root, file);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, source);
  }
}

export async function serveMermaidAssets(middlewares: { use(handler: Middleware): unknown }): Promise<void> {
  const assets = await readMermaidAssets();
  middlewares.use((request, response, next) => {
    const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
    if (!pathname.startsWith(mermaidAssetBase)) return next();
    const source = assets.get(pathname.slice(mermaidAssetBase.length));
    if (source === undefined) { response.statusCode = 404; response.end(); return; }
    response.setHeader('Content-Type', pathname.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/plain; charset=utf-8');
    response.end(source);
  });
}
