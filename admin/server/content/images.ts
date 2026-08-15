import { readFile, readdir, stat } from 'node:fs/promises';
import { basename, extname, posix, relative } from 'node:path';
import type {
  ImageAsset,
  ImageReference,
  PostDocument,
  StoredPostDocument,
} from '../../shared/content-types';
import { resolveContentPath } from './paths';
import { sha256Revision } from './storage';

const imageExtensions = new Set(['.avif', '.gif', '.jpeg', '.jpg', '.png', '.svg', '.webp']);

function withoutFencedCode(markdown: string): string {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  let fence: { marker: string; length: number } | undefined;
  return lines.map((line) => {
    if (!fence) {
      const opening = /^ {0,3}(`{3,}|~{3,})/.exec(line);
      if (!opening) return line;
      fence = { marker: opening[1][0], length: opening[1].length };
      return '';
    }
    const closing = new RegExp(`^ {0,3}${fence.marker === '`' ? '`' : '~'}{${fence.length},}\\s*$`);
    if (closing.test(line)) fence = undefined;
    return '';
  }).join('\n');
}

function unquoteDestination(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith('<') && trimmed.endsWith('>')) return trimmed.slice(1, -1);
  return trimmed;
}

export function scanPostImageReferences(post: PostDocument): ImageReference[] {
  const references: ImageReference[] = [];
  if (post.cover) {
    references.push({ kind: 'cover', postSlug: post.slug, value: post.cover });
  }

  const markdown = withoutFencedCode(post.body);
  const inlinePattern = /!\[[^\]]*]\(\s*(<[^>]+>|[^\s)]+)(?:\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?\s*\)/g;
  let inline: RegExpExecArray | null;
  while ((inline = inlinePattern.exec(markdown)) !== null) {
    references.push({
      kind: 'body',
      postSlug: post.slug,
      value: unquoteDestination(inline[1]),
    });
  }

  const definitions = new Map<string, string>();
  const definitionPattern = /^ {0,3}\[([^\]]+)]:\s*(<[^>]+>|\S+)/gm;
  let definition: RegExpExecArray | null;
  while ((definition = definitionPattern.exec(markdown)) !== null) {
    definitions.set(definition[1].trim().toLowerCase(), unquoteDestination(definition[2]));
  }
  const referencePattern = /!\[[^\]]*]\[([^\]]+)]/g;
  let reference: RegExpExecArray | null;
  while ((reference = referencePattern.exec(markdown)) !== null) {
    const value = definitions.get(reference[1].trim().toLowerCase());
    if (value) references.push({ kind: 'body', postSlug: post.slug, value });
  }

  return references;
}

function contentImagePath(value: string): string | undefined {
  const clean = value.split(/[?#]/, 1)[0].replace(/\\/g, '/');
  if (!clean || /^[a-z][a-z0-9+.-]*:/i.test(clean)) return undefined;
  if (clean.startsWith('/media/')) {
    const publicPath = posix.normalize(clean.slice('/media/'.length));
    return publicPath.startsWith('../') || publicPath === '.' ? undefined : publicPath;
  }
  if (clean.startsWith('/')) return undefined;
  const normalized = posix.normalize(posix.join('blog', clean));
  if (!normalized.startsWith('images/')) return undefined;
  return normalized.slice('images/'.length);
}

async function listImagePaths(root: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
  const paths: string[] = [];
  for (const entry of entries) {
    const path = resolveContentPath(root, entry.name);
    if (entry.isDirectory()) {
      paths.push(...await listImagePaths(path));
    } else if (entry.isFile() && imageExtensions.has(extname(entry.name).toLowerCase())) {
      paths.push(path);
    }
  }
  return paths;
}

export async function listImages(
  root: string,
  posts: StoredPostDocument[],
): Promise<ImageAsset[]> {
  const imagesRoot = resolveContentPath(root, 'images');
  const references = posts.flatMap(scanPostImageReferences);
  const referencesByPath = new Map<string, ImageReference[]>();
  for (const reference of references) {
    const path = contentImagePath(reference.value);
    if (!path) continue;
    const existing = referencesByPath.get(path) ?? [];
    existing.push(reference);
    referencesByPath.set(path, existing);
  }

  const assets = await Promise.all((await listImagePaths(imagesRoot)).map(async (path) => {
    const content = await readFile(path);
    const info = await stat(path);
    const assetPath = relative(imagesRoot, path).replace(/\\/g, '/');
    return {
      path: assetPath,
      fileName: basename(path),
      byteSize: info.size,
      revision: sha256Revision(content),
      references: referencesByPath.get(assetPath) ?? [],
    };
  }));
  return assets.sort((left, right) => left.path.localeCompare(right.path));
}
