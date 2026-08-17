import { randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import type { ContentRepository } from '../content/repository';
import { resolveContentPath } from '../content/paths';

export type TrashItemType = 'post' | 'clip' | 'image';

export interface TrashItem {
  id: string;
  type: TrashItemType;
  title: string;
  detail: string;
  deletedAt: string;
}

interface AssetTrashMetadata {
  deletedAt: string;
  path?: string;
  sha256?: string;
  slug?: string;
  title?: string;
  file?: string;
}

const trashIdPattern = /^[a-f0-9-]{36}$/i;

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}

function alreadyExistsError(): NodeJS.ErrnoException {
  return Object.assign(new Error('Content already exists at the restore destination.'), { code: 'EEXIST' });
}

async function readAssetTrash(root: string, type: 'clips' | 'images'): Promise<Array<{
  id: string;
  metadata: AssetTrashMetadata;
}>> {
  const area = resolve(root, type);
  let entries;
  try {
    entries = await readdir(area, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
  const items = await Promise.all(entries.filter((entry) => entry.isDirectory()).map(async (entry) => {
    try {
      const metadata = JSON.parse(
        await readFile(resolve(area, entry.name, 'restore.json'), 'utf8'),
      ) as AssetTrashMetadata;
      return { id: entry.name, metadata };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT' || error instanceof SyntaxError) return undefined;
      throw error;
    }
  }));
  return items.filter((item): item is NonNullable<typeof item> => Boolean(item));
}

export async function listTrash(options: {
  contentRoot: string;
  trashRoot: string;
  repository: ContentRepository;
}): Promise<TrashItem[]> {
  const posts = (await options.repository.listPosts({ includeDeleted: true }))
    .filter((post) => post.deleted);
  const postItems = await Promise.all(posts.map(async (post): Promise<TrashItem> => {
    const path = resolveContentPath(options.contentRoot, '.trash', 'blog', post.fileName);
    const info = await stat(path);
    return {
      id: post.slug,
      type: 'post',
      title: post.title,
      detail: post.slug,
      deletedAt: info.ctime.toISOString(),
    };
  }));
  const [clips, images] = await Promise.all([
    readAssetTrash(options.trashRoot, 'clips'),
    readAssetTrash(options.trashRoot, 'images'),
  ]);
  return [
    ...postItems,
    ...clips.map(({ id, metadata }): TrashItem => ({
      id,
      type: 'clip',
      title: metadata.title || metadata.slug || '未命名剪切内容',
      detail: metadata.file || metadata.slug || id,
      deletedAt: metadata.deletedAt,
    })),
    ...images.map(({ id, metadata }): TrashItem => ({
      id,
      type: 'image',
      title: basename(metadata.path || id),
      detail: metadata.path || id,
      deletedAt: metadata.deletedAt,
    })),
  ].sort((left, right) => right.deletedAt.localeCompare(left.deletedAt));
}

export async function moveClipToTrash(options: {
  contentRoot: string;
  trashRoot: string;
  repository: ContentRepository;
  slug: string;
}): Promise<string> {
  const clip = await options.repository.readClip(options.slug);
  const source = resolveContentPath(options.contentRoot, 'clips', options.slug);
  const id = randomUUID();
  const base = resolve(options.trashRoot, 'clips', id);
  await mkdir(base, { recursive: true });
  await rename(source, resolve(base, options.slug));
  await writeFile(resolve(base, 'restore.json'), `${JSON.stringify({
    slug: options.slug,
    title: clip.title,
    file: clip.file,
    deletedAt: new Date().toISOString(),
  })}\n`, 'utf8');
  return id;
}

export async function moveImageToTrash(options: {
  contentRoot: string;
  trashRoot: string;
  historyRoot: string;
  path: string;
  sha256: string;
  bytes: Buffer;
}): Promise<string> {
  const blob = resolve(options.historyRoot, options.sha256);
  await writeFile(blob, options.bytes, { flag: 'wx', mode: 0o600 }).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'EEXIST') throw error;
  });
  const id = randomUUID();
  const base = resolve(options.trashRoot, 'images', id);
  const target = resolve(base, options.path);
  await mkdir(dirname(target), { recursive: true });
  await rename(resolveContentPath(options.contentRoot, 'images', options.path), target);
  await writeFile(resolve(base, 'restore.json'), `${JSON.stringify({
    path: options.path,
    sha256: options.sha256,
    deletedAt: new Date().toISOString(),
  })}\n`, 'utf8');
  return id;
}

export async function restoreTrashItem(options: {
  contentRoot: string;
  trashRoot: string;
  repository: ContentRepository;
  type: TrashItemType;
  id: string;
}): Promise<void> {
  if (options.type === 'post') {
    const post = (await options.repository.listPosts({ includeDeleted: true }))
      .find((item) => item.deleted && item.slug === options.id);
    if (!post) throw new Error('Deleted post was not found.');
    await options.repository.restorePost(post.slug, { expectedRevision: post.revision });
    return;
  }
  if (!trashIdPattern.test(options.id)) throw new Error('Invalid trash identifier.');
  const area = options.type === 'clip' ? 'clips' : 'images';
  const base = resolve(options.trashRoot, area, options.id);
  const metadata = JSON.parse(await readFile(resolve(base, 'restore.json'), 'utf8')) as AssetTrashMetadata;
  if (options.type === 'clip') {
    if (!metadata.slug) throw new Error('Clip trash metadata is invalid.');
    const source = resolveContentPath(base, metadata.slug);
    const target = resolveContentPath(options.contentRoot, 'clips', metadata.slug);
    if (await pathExists(target)) throw alreadyExistsError();
    await mkdir(dirname(target), { recursive: true });
    await rename(source, target);
  } else {
    if (!metadata.path) throw new Error('Image trash metadata is invalid.');
    const source = resolveContentPath(base, metadata.path);
    const target = resolveContentPath(options.contentRoot, 'images', metadata.path);
    if (await pathExists(target)) throw alreadyExistsError();
    await mkdir(dirname(target), { recursive: true });
    await rename(source, target);
  }
  await rm(base, { recursive: true, force: true });
}


export async function deleteTrashItem(options: {
  contentRoot: string;
  trashRoot: string;
  repository: ContentRepository;
  type: TrashItemType;
  id: string;
}): Promise<void> {
  if (options.type === 'post') {
    const post = (await options.repository.listPosts({ includeDeleted: true }))
      .find((item) => item.deleted && item.slug === options.id);
    if (!post) {
      throw Object.assign(new Error('Deleted post was not found.'), { code: 'ENOENT' });
    }
    await rm(resolveContentPath(options.contentRoot, '.trash', 'blog', post.fileName));
    return;
  }
  if (!trashIdPattern.test(options.id)) throw new Error('Invalid trash identifier.');
  const area = options.type === 'clip' ? 'clips' : 'images';
  const base = resolve(options.trashRoot, area, options.id);
  if (!await pathExists(base)) {
    throw Object.assign(new Error('Trash item was not found.'), { code: 'ENOENT' });
  }
  await rm(base, { recursive: true });
}
