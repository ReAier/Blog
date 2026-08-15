import { readFile, readdir, rm, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

const retentionMs = 30 * 24 * 60 * 60 * 1000;

export async function cleanupExpiredImageTrash(
  trashRoot: string,
  now = Date.now(),
): Promise<string[]> {
  const imagesRoot = resolve(trashRoot, 'images');
  let entries;
  try {
    entries = await readdir(imagesRoot, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }

  const removed: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const base = resolve(imagesRoot, entry.name);
    const metadataPath = resolve(base, 'restore.json');
    try {
      const [metadata, info] = await Promise.all([
        readFile(metadataPath, 'utf8').then((value) => JSON.parse(value) as { deletedAt?: string }),
        stat(metadataPath),
      ]);
      const deletedAt = metadata.deletedAt ? Date.parse(metadata.deletedAt) : info.mtimeMs;
      if (!Number.isFinite(deletedAt) || now - deletedAt <= retentionMs) continue;
      await rm(base, { recursive: true, force: true });
      removed.push(entry.name);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT' || error instanceof SyntaxError) continue;
      throw error;
    }
  }
  return removed.sort();
}
