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
import type { ContentRepository } from '../content/repository';
import { jsonSchema } from '../schemas';

interface PreviewMarkdownNode {
  type?: string;
  url?: string;
  children?: PreviewMarkdownNode[];
}

export function previewManagedImageUrl(value: string, siteOrigin: string): string {
  try {
    const candidate = new URL(value);
    const site = new URL(siteOrigin);
    if (candidate.origin === site.origin && candidate.pathname.startsWith('/media/')) {
      return candidate.pathname + candidate.search + candidate.hash;
    }
  } catch {
    // Relative and non-URL values are already handled by remarkManagedImages.
  }
  return value;
}

function remarkPreviewManagedImages(options: { siteOrigin: string }) {
  const transform = (node: PreviewMarkdownNode): void => {
    if (node.type === 'image' && node.url) {
      node.url = previewManagedImageUrl(node.url, options.siteOrigin);
    }
    node.children?.forEach(transform);
  };
  return (tree: PreviewMarkdownNode) => transform(tree);
}
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
  repository: ContentRepository,
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
      [remarkPreviewManagedImages, { siteOrigin: config.siteOrigin }],
      [remarkClipCards, { clipsRoot: resolve(config.contentRoot, 'clips') }],
      remarkCalloutCards,
      remarkReferenceCards,
      remarkProblemCards,
    ],
    rehypePlugins: [rehypeKatex],
  });

  const render = async (markdown: string) => {
    const result = await processor.render(markdown);
    return {
      html: buildInstantPreviewDocument(result.code, siteCss, katexCss),
      generatedAt: new Date().toISOString(),
    };
  };

  app.get('/api/posts/:slug/preview', async (request) => {
    const post = await repository.readPost((request.params as { slug: string }).slug);
    return render(post.body);
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
    return render(body.markdown ?? body.body ?? '');
  });
}
