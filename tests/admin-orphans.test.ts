import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { listOrphanClipFiles } from '../admin/server/content/orphans';

const root = join(process.cwd(), '.admin-data-test-orphans');

describe('orphan clip discovery', () => {
  it('lists source files that are not referenced by active article fences', async () => {
    await rm(root, { recursive: true, force: true });
    try {
      await mkdir(join(root, 'clips'), { recursive: true });
      await writeFile(join(root, 'clips', 'used.ts'), 'used');
      await writeFile(join(root, 'clips', 'orphan.py'), 'orphan');
      await writeFile(join(root, 'clips', '.gitkeep'), '');

      await expect(listOrphanClipFiles(root, new Set(['used.ts']))).resolves.toEqual([
        { file: 'orphan.py', slug: 'orphan' },
      ]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
