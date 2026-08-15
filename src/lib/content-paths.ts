import { resolve } from 'node:path';

export interface ContentPaths {
  root: string;
  blog: string;
  clips: string;
  images: string;
  redirects: string;
}

export function getContentPaths(projectRoot = process.cwd()): ContentPaths {
  const root = resolve(process.env.BLOG_CONTENT_ROOT || resolve(projectRoot, 'src/content'));
  return {
    root,
    blog: resolve(root, 'blog'),
    clips: resolve(root, 'clips'),
    images: resolve(root, 'images'),
    redirects: resolve(root, 'redirects.json'),
  };
}
