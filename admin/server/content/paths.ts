import { isAbsolute, relative, resolve } from 'node:path';
import { ContentPathError } from './errors';

export interface ContentRootOptions {
  cwd?: string;
  env?: Record<string, string | undefined>;
}

export function getContentRoot(options: ContentRootOptions = {}): string {
  const cwd = options.cwd ?? process.cwd();
  const env = options.env ?? process.env;
  return resolve(cwd, env.BLOG_CONTENT_ROOT || 'src/content');
}

export function resolveContentPath(root: string, ...segments: string[]): string {
  const resolvedRoot = resolve(root);

  for (const segment of segments) {
    if (isAbsolute(segment)) {
      throw new ContentPathError(`Content path must be relative: ${segment}`);
    }
  }

  const resolvedPath = resolve(resolvedRoot, ...segments);
  const relativePath = relative(resolvedRoot, resolvedPath);
  if (relativePath.startsWith('..') || isAbsolute(relativePath)) {
    throw new ContentPathError(`Content path escapes BLOG_CONTENT_ROOT: ${segments.join('/')}`);
  }
  return resolvedPath;
}
