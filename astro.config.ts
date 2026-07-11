import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'http://blog.reaier.top',
  output: 'static',
  integrations: [sitemap()],
});
