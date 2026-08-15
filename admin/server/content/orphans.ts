import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { deriveClipSlug } from './clips';

export interface OrphanClipFile {
  file: string;
  slug: string;
}

export async function listOrphanClipFiles(
  contentRoot: string,
  referencedFiles: ReadonlySet<string>,
): Promise<OrphanClipFile[]> {
  const clipsRoot = resolve(contentRoot, 'clips');
  let entries;
  try {
    entries = await readdir(clipsRoot, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
  return entries
    .filter((entry) => entry.isFile() && !entry.name.startsWith('.') && !referencedFiles.has(entry.name))
    .map((entry) => ({ file: entry.name, slug: deriveClipSlug(entry.name) }))
    .sort((left, right) => left.file.localeCompare(right.file));
}
