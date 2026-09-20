import { unified } from '@astrojs/markdown-remark';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import { managedContentIntegration } from './src/integrations/managed-content';
import { mermaidIntegration } from './src/integrations/mermaid';
import { getContentPaths } from './src/lib/content-paths';
import { remarkCalloutCards } from './src/lib/remark-callout-card';
import { remarkClipCards } from './src/lib/remark-clip-card';
import { remarkManagedImages } from './src/lib/remark-managed-images';
import { remarkReferenceCards } from './src/lib/remark-reference-card';
import { remarkProblemCards } from './src/lib/remark-problem-card';
import { remarkMermaid } from './src/lib/remark-mermaid';
import { SHIKI_CONFIG } from './src/lib/syntax-highlighting';

const contentPaths = getContentPaths();

export default defineConfig({
  site: 'https://blog.reaier.top',
  output: 'static',
  cacheDir: './.astro',
  vite: {
    cacheDir: '.astro/vite',
  },
  integrations: [
    sitemap({ filter: (page) => !page.includes('/clips/') }),
    managedContentIntegration(contentPaths.images),
    mermaidIntegration(),
  ],
  markdown: {
    syntaxHighlight: 'shiki',
    shikiConfig: SHIKI_CONFIG,
    processor: unified({
      smartypants: false,
      remarkPlugins: [remarkMath, remarkManagedImages, remarkCalloutCards, remarkClipCards, remarkReferenceCards, remarkProblemCards, remarkMermaid],
      rehypePlugins: [rehypeKatex],
    }),
  },
});
