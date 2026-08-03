import { unified } from '@astrojs/markdown-remark';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import { remarkClipCards } from './src/lib/remark-clip-card';
import { remarkReferenceCards } from './src/lib/remark-reference-card';

export default defineConfig({
  site: 'https://blog.reaier.top',
  output: 'static',
  integrations: [sitemap({ filter: (page) => !page.includes('/clips/') })],
  markdown: {
    processor: unified({
      smartypants: false,
      remarkPlugins: [remarkMath, remarkClipCards, remarkReferenceCards],
      rehypePlugins: [rehypeKatex],
    }),
  },
});
