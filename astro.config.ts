import { unified } from '@astrojs/markdown-remark';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import { remarkCalloutCards } from './src/lib/remark-callout-card';
import { remarkClipCards } from './src/lib/remark-clip-card';
import { remarkReferenceCards } from './src/lib/remark-reference-card';
import { remarkProblemCards } from './src/lib/remark-problem-card';
import { SHIKI_CONFIG } from './src/lib/syntax-highlighting';

export default defineConfig({
  site: 'https://blog.reaier.top',
  output: 'static',
  integrations: [sitemap({ filter: (page) => !page.includes('/clips/') })],
  markdown: {
    syntaxHighlight: 'shiki',
    shikiConfig: SHIKI_CONFIG,
    processor: unified({
      smartypants: false,
      remarkPlugins: [remarkMath, remarkCalloutCards, remarkClipCards, remarkReferenceCards, remarkProblemCards],
      rehypePlugins: [rehypeKatex],
    }),
  },
});
