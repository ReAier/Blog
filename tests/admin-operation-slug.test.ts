import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { recoverInterruptedContentOperations, withContentOperation } from '../admin/server/content/operation-log';
import { createContentRepository } from '../admin/server/content/repository';
import { migrateClipSlug, migratePostSlug } from '../admin/server/content/slug-migration';
import { combinedClipRevision, createClipTransaction } from '../admin/server/content/transactions';

const roots: string[] = [];
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'admin-migration-'));
  roots.push(root);
  const contentRoot = join(root, 'content');
  const jobsRoot = join(root, 'jobs');
  for (const name of ['blog', 'clips', 'images']) await mkdir(join(contentRoot, name), { recursive: true });
  const repository = createContentRepository({ root: contentRoot });
  return { root, contentRoot, jobsRoot, repository };
}
afterEach(async () => Promise.all(roots.splice(0).map((path) => rm(path, { recursive: true, force: true }))));

describe('content operation journal', () => {
  it('restores the pre-operation tree after a failed multi-file mutation', async () => {
    const { contentRoot, jobsRoot } = await fixture();
    await writeFile(join(contentRoot, 'blog', 'owner.md'), 'before\n');
    await expect(withContentOperation({
      contentRoot,
      operationsRoot: join(jobsRoot, 'operations'),
      type: 'test',
      execute: async () => {
        await writeFile(join(contentRoot, 'blog', 'owner.md'), 'after\n');
        throw new Error('stop');
      },
    })).rejects.toThrow('stop');
    expect(await readFile(join(contentRoot, 'blog', 'owner.md'), 'utf8')).toBe('before\n');
    expect(await recoverInterruptedContentOperations({
      contentRoot,
      operationsRoot: join(jobsRoot, 'operations'),
    })).toEqual([]);
  });
});

describe('explicit slug migration', () => {
  it('renames a post without moving independent images and adds a 308 redirect source', async () => {
    const { repository, contentRoot } = await fixture();
    const created = await repository.createPost({
      slug: 'old-post',
      title: 'Old',
      description: 'Post',
      publishedAt: '2026-08-13',
      tags: [],
      draft: true,
      featured: false,
      cover: '../images/cover-123456789abc.webp',
      body: '![cover](../images/cover-123456789abc.webp)\n',
    });
    await writeFile(join(contentRoot, 'images', 'cover-123456789abc.webp'), 'image');

    const migrated = await migratePostSlug({
      repository,
      oldSlug: 'old-post',
      newSlug: 'new-post',
      expectedRevision: created.revision,
    });

    expect(migrated.slug).toBe('new-post');
    expect(migrated.cover).toBe('../images/cover-123456789abc.webp');
    expect(migrated.body).toContain('../images/cover-123456789abc.webp');
    expect(await readFile(join(contentRoot, 'images', 'cover-123456789abc.webp'), 'utf8')).toBe('image');
    expect(JSON.parse(await readFile(join(contentRoot, 'redirects.json'), 'utf8'))).toEqual({
      '/posts/old-post/': '/posts/new-post/',
    });
  });

  it('renames a clip source, rewrites its fence and emits page and text redirects', async () => {
    const { repository, contentRoot } = await fixture();
    const owner = await repository.createPost({
      slug: 'owner', title: 'Owner', description: 'Post', publishedAt: '2026-08-13',
      tags: [], draft: true, featured: false, body: 'Body\n',
    });
    const clip = await createClipTransaction(repository, {
      slug: 'old-clip', ownerPostSlug: 'owner', expectedPostRevision: owner.revision,
      title: 'Clip', language: 'typescript', file: 'old-clip.ts', createdAt: '2026-08-13', code: 'export {};\n',
    });
    const migrated = await migrateClipSlug({
      repository,
      oldSlug: clip.slug,
      newFile: 'new-clip.ts',
      expectedRevision: combinedClipRevision(clip),
    });
    expect(migrated.slug).toBe('new-clip');
    expect(migrated.file).toBe('new-clip.ts');
    expect((await repository.readPost('owner')).body).toContain('slug: new-clip');
    expect(await readFile(join(contentRoot, 'clips', 'new-clip', 'new-clip.ts'), 'utf8')).toBe('export {};\n');
    expect(JSON.parse(await readFile(join(contentRoot, 'redirects.json'), 'utf8'))).toMatchObject({
      '/clips/old-clip/': '/clips/new-clip/',
      '/clips/old-clip.txt': '/clips/new-clip.txt',
    });
  });
});
