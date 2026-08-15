import { access, mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { PostDocument } from '../admin/shared/content-types';
import {
  ContentConflictError,
  ContentDuplicateError,
  ContentNotFoundError,
  createContentRepository,
} from '../admin/server/content/index';

const temporaryDirectories: string[] = [];

async function createContentRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'blog-admin-posts-'));
  temporaryDirectories.push(root);
  await Promise.all([
    mkdir(join(root, 'blog'), { recursive: true }),
    mkdir(join(root, 'clips'), { recursive: true }),
    mkdir(join(root, 'images'), { recursive: true }),
  ]);
  return root;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

function post(slug: string, overrides: Partial<PostDocument> = {}): PostDocument {
  return {
    slug,
    title: `Title for ${slug}`,
    description: `Description for ${slug}`,
    publishedAt: '2026-08-01',
    tags: ['Admin'],
    draft: true,
    featured: false,
    body: `Body for ${slug}.\n`,
    ...overrides,
  };
}

describe('post repository', () => {
  it('creates, reads, and lists active posts in stable slug order', async () => {
    const root = await createContentRoot();
    const repository = createContentRepository({ root });

    const second = await repository.createPost(post('second-post'));
    const first = await repository.createPost(post('first-post', { cover: '../images/cover.webp' }));

    expect(second.fileName).toBe('second-post.md');
    expect(first.revision).toMatch(/^[a-f0-9]{64}$/);
    await expect(repository.readPost('first-post')).resolves.toEqual(first);
    expect((await repository.listPosts()).map(({ slug }) => slug)).toEqual([
      'first-post',
      'second-post',
    ]);
  });

  it('rejects duplicate post slugs in both the active and deleted areas', async () => {
    const root = await createContentRoot();
    const repository = createContentRepository({ root });

    const created = await repository.createPost(post('duplicate-post'));
    await expect(repository.createPost(post('duplicate-post'))).rejects.toBeInstanceOf(
      ContentDuplicateError,
    );
    await repository.softDeletePost('duplicate-post', { expectedRevision: created.revision });
    await expect(repository.createPost(post('duplicate-post'))).rejects.toBeInstanceOf(
      ContentDuplicateError,
    );
  });

  it('updates only the expected revision and returns the new revision', async () => {
    const root = await createContentRoot();
    const repository = createContentRepository({ root });
    const created = await repository.createPost(post('editable-post'));

    const updated = await repository.updatePost(
      'editable-post',
      { ...created, title: 'Updated title' },
      { expectedRevision: created.revision },
    );

    expect(updated.title).toBe('Updated title');
    expect(updated.revision).not.toBe(created.revision);
    await expect(
      repository.updatePost(
        'editable-post',
        { ...updated, title: 'Stale title' },
        { expectedRevision: created.revision },
      ),
    ).rejects.toBeInstanceOf(ContentConflictError);
    expect((await repository.readPost('editable-post')).title).toBe('Updated title');
  });

  it('does not allow an update to rename the post implicitly', async () => {
    const root = await createContentRoot();
    const repository = createContentRepository({ root });
    const created = await repository.createPost(post('stable-slug'));

    await expect(
      repository.updatePost(
        'stable-slug',
        { ...created, slug: 'renamed-post' },
        { expectedRevision: created.revision },
      ),
    ).rejects.toThrow(/slug.*match/i);
  });

  it('soft deletes and restores with revision checks while keeping deleted posts out of active lists', async () => {
    const root = await createContentRoot();
    const repository = createContentRepository({ root });
    const created = await repository.createPost(post('recoverable-post'));

    const deleted = await repository.softDeletePost('recoverable-post', {
      expectedRevision: created.revision,
    });

    expect(deleted.deleted).toBe(true);
    await expect(repository.readPost('recoverable-post')).rejects.toBeInstanceOf(ContentNotFoundError);
    expect((await repository.listPosts()).map(({ slug }) => slug)).toEqual([]);
    expect((await repository.listPosts({ includeDeleted: true }))).toEqual([deleted]);
    await expect(access(join(root, '.trash', 'blog', 'recoverable-post.md'))).resolves.toBeUndefined();

    await expect(
      repository.restorePost('recoverable-post', { expectedRevision: '0'.repeat(64) }),
    ).rejects.toBeInstanceOf(ContentConflictError);

    const restored = await repository.restorePost('recoverable-post', {
      expectedRevision: deleted.revision,
    });
    expect(restored.deleted).toBe(false);
    await expect(repository.readPost('recoverable-post')).resolves.toEqual(restored);
  });
});
