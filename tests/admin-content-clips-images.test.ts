import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type {
  ClipMetadata,
  ContentMutationRecord,
  PostDocument,
} from '../admin/shared/content-types';
import {
  ContentConflictError,
  ContentDuplicateError,
  ContentValidationError,
  createContentRepository,
  scanPostImageReferences,
} from '../admin/server/content/index';

const temporaryDirectories: string[] = [];

async function createContentRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'blog-admin-clips-'));
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

function post(slug: string, body: string, overrides: Partial<PostDocument> = {}): PostDocument {
  return {
    slug,
    title: `Title for ${slug}`,
    description: `Description for ${slug}`,
    publishedAt: '2026-08-01',
    tags: ['Admin'],
    draft: false,
    featured: false,
    body,
    ...overrides,
  };
}

const alphaMetadata: ClipMetadata = {
  title: 'Alpha clip',
  description: 'The first clip.',
  language: 'typescript',
  file: 'alpha.ts',
  createdAt: '2026-08-01',
};

const alphaFence = `\`\`\`clip
title: Alpha clip
description: The first clip.
language: typescript
file: alpha.ts
createdAt: 2026-08-01
\`\`\``;

describe('clip repository', () => {
  it('scans clip fences, reads associated source files, and returns stable revisions', async () => {
    const root = await createContentRoot();
    const repository = createContentRepository({ root });
    await repository.createClip('alpha', alphaMetadata, 'export const alpha = 1;\n');
    await repository.createPost(post('clip-owner', 'Before.\n\n```clip\nslug: alpha\n```\n\nAfter.\n'));

    const clips = await repository.listClips();

    expect(clips).toHaveLength(1);
    expect(clips[0]).toMatchObject({
      ...alphaMetadata,
      slug: 'alpha',
      code: 'export const alpha = 1;\n',
      references: [{ postSlug: 'clip-owner', kind: 'body' }],
    });
    expect(clips[0].metadataRevision).toMatch(/^[a-f0-9]{64}$/);
    expect(clips[0].codeRevision).toMatch(/^[a-f0-9]{64}$/);
    await expect(repository.readClip('alpha')).resolves.toEqual(clips[0]);
  });

  it('rejects unknown clip fields and invalid date ordering', async () => {
    const root = await createContentRoot();
    const repository = createContentRepository({ root });
    await writeFile(join(root, 'clips', 'alpha.ts'), 'code', 'utf8');
    await repository.createPost(post('invalid-clip', alphaFence.replace(
      'createdAt: 2026-08-01',
      'createdAt: 2026-08-10\nupdatedAt: 2026-08-01\nowner: Aier',
    )));

    await expect(repository.listClips()).rejects.toBeInstanceOf(ContentValidationError);
    await expect(repository.listClips()).rejects.toThrow(/unknown clip field: owner/i);
  });

  it('detects duplicate source filenames before duplicate slugs', async () => {
    const root = await createContentRoot();
    const repository = createContentRepository({ root });
    await writeFile(join(root, 'clips', 'alpha.ts'), 'code', 'utf8');
    await repository.createPost(post('first-owner', alphaFence));
    await repository.createPost(post('second-owner', alphaFence.replace('Alpha clip', 'Another clip')));

    await expect(repository.listClips()).rejects.toBeInstanceOf(ContentDuplicateError);
    await expect(repository.listClips()).rejects.toThrow(/duplicate clip file: alpha\.ts/i);
  });

  it('detects different filenames that derive the same slug', async () => {
    const root = await createContentRoot();
    const repository = createContentRepository({ root });
    await Promise.all([
      writeFile(join(root, 'clips', 'astro.config.ts'), 'one', 'utf8'),
      writeFile(join(root, 'clips', 'astro-config.js'), 'two', 'utf8'),
    ]);
    const first = alphaFence.replaceAll('alpha.ts', 'astro.config.ts');
    const second = alphaFence
      .replaceAll('alpha.ts', 'astro-config.js')
      .replace('Alpha clip', 'Another clip');
    await repository.createPost(post('slug-owner-one', first));
    await repository.createPost(post('slug-owner-two', second));

    await expect(repository.listClips()).rejects.toThrow(/duplicate clip slug: astro-config/i);
  });

  it('updates exactly one clip metadata fence and checks the owning post revision', async () => {
    const root = await createContentRoot();
    const repository = createContentRepository({ root });
    await repository.createClip('alpha', alphaMetadata, 'old code\n');
    const untouchedFence = `\`\`\`reference\ntitle: Untouched\nurl: https://example.com\n\`\`\``;
    await repository.createPost(post('precise-owner', `Prefix\n\n\`\`\`clip\nslug: alpha\n\`\`\`\n\n${untouchedFence}\n\nSuffix\n`));
    const clip = await repository.readClip('alpha');

    const updated = await repository.updateClipMetadata(
      'alpha',
      {
        ...alphaMetadata,
        title: 'Updated alpha',
        description: undefined,
        updatedAt: '2026-08-13',
      },
      { expectedRevision: clip.metadataRevision },
    );

    expect(updated.title).toBe('Updated alpha');
    expect(updated.description).toBeUndefined();
    expect(updated.code).toBe('old code\n');
    const markdown = await readFile(join(root, 'blog', 'precise-owner.md'), 'utf8');
    expect(markdown).toContain('Prefix');
    expect(markdown).toContain(untouchedFence);
    expect(markdown).toContain('Suffix');
    expect(markdown).toContain('slug: alpha');
    const manifest = await readFile(join(root, 'clips', 'alpha', 'meta.json'), 'utf8');
    expect(manifest).not.toContain('The first clip.');
    await expect(
      repository.updateClipMetadata('alpha', alphaMetadata, {
        expectedRevision: clip.metadataRevision,
      }),
    ).rejects.toBeInstanceOf(ContentConflictError);
  });

  it('updates only the associated source code and checks its revision', async () => {
    const root = await createContentRoot();
    const repository = createContentRepository({ root });
    await repository.createClip('alpha', alphaMetadata, 'old code\n');
    await repository.createPost(post('code-owner', '```clip\nslug: alpha\n```'));
    const clip = await repository.readClip('alpha');

    const updated = await repository.updateClipCode(
      'alpha',
      'new code\n',
      { expectedRevision: clip.codeRevision },
    );

    expect(updated.code).toBe('new code\n');
    expect(updated.metadataRevision).toBe(clip.metadataRevision);
    await expect(
      repository.updateClipCode('alpha', 'stale code', { expectedRevision: clip.codeRevision }),
    ).rejects.toBeInstanceOf(ContentConflictError);
    await expect(readFile(join(root, 'clips', 'alpha', 'alpha.ts'), 'utf8')).resolves.toBe('new code\n');
  });
});

describe('content image references', () => {
  it('scans cover and Markdown body references while ignoring code fences', () => {
    const document = post(
      'image-owner',
      `![Body](../images/gallery/body.webp)\n\n\`\`\`md\n![Ignored](../images/gallery/ignored.webp)\n\`\`\`\n\n![Reference][hero]\n\n[hero]: ../images/gallery/reference.png\n`,
      { cover: '../images/gallery/cover.webp' },
    );

    expect(scanPostImageReferences(document)).toEqual([
      { kind: 'cover', postSlug: 'image-owner', value: '../images/gallery/cover.webp' },
      { kind: 'body', postSlug: 'image-owner', value: '../images/gallery/body.webp' },
      { kind: 'body', postSlug: 'image-owner', value: '../images/gallery/reference.png' },
    ]);
  });

  it('lists image files with revisions, sizes, and matching post references', async () => {
    const root = await createContentRoot();
    const repository = createContentRepository({ root });
    await mkdir(join(root, 'images', 'gallery'), { recursive: true });
    await Promise.all([
      writeFile(join(root, 'images', 'gallery', 'body.webp'), Buffer.from([1, 2, 3])),
      writeFile(join(root, 'images', 'gallery', 'cover.webp'), Buffer.from([4, 5])),
      writeFile(join(root, 'images', 'unused.png'), Buffer.from([6])),
    ]);
    await repository.createPost(post(
      'asset-owner',
      '![Body](../images/gallery/body.webp)\n',
      { cover: '../images/gallery/cover.webp' },
    ));

    const assets = await repository.listImages();

    expect(assets.map(({ path }) => path)).toEqual([
      'gallery/body.webp',
      'gallery/cover.webp',
      'unused.png',
    ]);
    expect(assets[0]).toMatchObject({
      fileName: 'body.webp',
      byteSize: 3,
      references: [
        { kind: 'body', postSlug: 'asset-owner', value: '../images/gallery/body.webp' },
      ],
    });
    expect(assets[1].references[0].kind).toBe('cover');
    expect(assets[2].references).toEqual([]);
    for (const asset of assets) expect(asset.revision).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe('history integration seam', () => {
  it('reports mutation records without implementing history storage', async () => {
    const root = await createContentRoot();
    const records: ContentMutationRecord[] = [];
    const repository = createContentRepository({
      root,
      history: {
        record: async (record) => {
          records.push(record);
        },
      },
    });

    const created = await repository.createPost(post('history-post', 'History body.\n'));
    await repository.updatePost(
      'history-post',
      { ...created, title: 'History updated' },
      { expectedRevision: created.revision },
    );

    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({
      action: 'create',
      entity: 'post',
      id: 'history-post',
      beforeRevision: null,
      afterRevision: created.revision,
    });
    expect(records[1]).toMatchObject({
      action: 'update',
      entity: 'post',
      id: 'history-post',
      beforeRevision: created.revision,
    });
  });
});
