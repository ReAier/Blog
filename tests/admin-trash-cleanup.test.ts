import { mkdir, rm, stat, utimes, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { cleanupExpiredImageTrash } from '../admin/server/trash/cleanup';

async function trashEntry(root: string, id: string, deletedAt: string) {
  const path = join(root, 'images', id);
  await mkdir(path, { recursive: true });
  await writeFile(join(path, 'restore.json'), `${JSON.stringify({ path: 'post/image.webp', deletedAt })}\n`);
  return path;
}

describe('image trash retention', () => {
  it('removes entries older than 30 days and keeps recent or malformed entries', async () => {
    const root = join(process.cwd(), '.admin-data-test-trash');
    await rm(root, { recursive: true, force: true });
    try {
      const now = Date.parse('2026-08-13T12:00:00.000Z');
      const old = await trashEntry(root, 'old', '2026-07-01T00:00:00.000Z');
      const recent = await trashEntry(root, 'recent', '2026-08-01T00:00:00.000Z');
      const malformed = join(root, 'images', 'malformed');
      await mkdir(malformed, { recursive: true });
      await writeFile(join(malformed, 'restore.json'), '{bad json');

      await expect(cleanupExpiredImageTrash(root, now)).resolves.toEqual(['old']);
      await expect(stat(old)).rejects.toMatchObject({ code: 'ENOENT' });
      await expect(stat(recent)).resolves.toBeDefined();
      await expect(stat(malformed)).resolves.toBeDefined();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('falls back to metadata mtime when deletedAt is absent', async () => {
    const root = join(process.cwd(), '.admin-data-test-trash-mtime');
    await rm(root, { recursive: true, force: true });
    try {
      const entry = join(root, 'images', 'legacy');
      await mkdir(entry, { recursive: true });
      const metadata = join(entry, 'restore.json');
      await writeFile(metadata, JSON.stringify({ path: 'post/image.webp' }));
      const old = new Date('2026-06-01T00:00:00.000Z');
      await utimes(metadata, old, old);

      await expect(cleanupExpiredImageTrash(root, Date.parse('2026-08-13T12:00:00.000Z')))
        .resolves.toEqual(['legacy']);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
