import type { ShikiConfig } from '@astrojs/markdown-remark';

export const SHIKI_CONFIG = {
  themes: {
    light: 'github-light',
    dark: 'github-dark',
  },
  defaultColor: false,
} satisfies ShikiConfig;
