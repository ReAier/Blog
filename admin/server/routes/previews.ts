import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import { readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import type { FastifyInstance, FastifyReply } from 'fastify';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import { buildInstantPreviewDocument } from '../../client/src/lib/preview';
import { remarkCalloutCards } from '../../../src/lib/remark-callout-card';
import { remarkManagedImages } from '../../../src/lib/remark-managed-images';
import { remarkClipCards } from '../../../src/lib/remark-clip-card';
import { remarkProblemCards } from '../../../src/lib/remark-problem-card';
import { remarkReferenceCards } from '../../../src/lib/remark-reference-card';
import type { AdminConfig } from '../config';
import { jsonSchema } from '../schemas';

export function previewKatexFontPath(projectRoot: string, name: string): string {
  if (!/^[A-Za-z0-9_-]+\.(?:woff2?|ttf)$/.test(name)) {
    throw new Error('Invalid KaTeX font path.');
  }
  return resolve(projectRoot, 'node_modules/katex/dist/fonts', name);
}

async function sendPreviewAsset(reply: FastifyReply, path: string): Promise<unknown> {
  const types: Record<string, string> = {
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
  };
  reply.type(types[extname(path).toLowerCase()] ?? 'application/octet-stream');
  return reply.send(await readFile(path));
}

export async function registerPreviewRoutes(
  app: FastifyInstance,
  config: AdminConfig,
): Promise<void> {
  const [siteCss, rawKatexCss] = await Promise.all([
    readFile(resolve(config.projectRoot, 'src/styles/global.css'), 'utf8'),
    readFile(resolve(config.projectRoot, 'node_modules/katex/dist/katex.min.css'), 'utf8'),
  ]);
  const katexCss = rawKatexCss.replaceAll(
    'url(fonts/',
    'url(/preview-assets/katex/fonts/',
  );

  app.get('/preview-assets/katex/fonts/:name', async (request, reply) => {
    const path = previewKatexFontPath(
      config.projectRoot,
      (request.params as { name: string }).name,
    );
    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Cache-Control', 'public, max-age=31536000, immutable');
    return sendPreviewAsset(reply, path);
  });

  const processor = await createMarkdownProcessor({
    remarkPlugins: [
      remarkMath,
      remarkManagedImages,
      [remarkClipCards, { clipsRoot: resolve(config.contentRoot, 'clips') }],
      remarkCalloutCards,
      remarkReferenceCards,
      remarkProblemCards,
    ],
    rehypePlugins: [rehypeKatex],
  });

  app.post('/api/previews/instant', {
    schema: jsonSchema({
      body: {
        type: 'object',
        additionalProperties: false,
        properties: {
          markdown: { type: 'string', maxLength: 2_000_000 },
          body: { type: 'string', maxLength: 2_000_000 },
        },
      },
    }),
  }, async (request) => {
    const body = request.body as { markdown?: string; body?: string };
    const result = await processor.render(body.markdown ?? body.body ?? '');
    return {
      html: buildInstantPreviewDocument(result.code, siteCss, katexCss),
      generatedAt: new Date().toISOString(),
    };
  });
}
