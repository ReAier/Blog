import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createContentRepository } from '../admin/server/content/repository';
import { ImageService } from '../admin/server/images/service';
import type { PostDocument } from '../admin/shared/content-types';

const temporaryDirectories: string[] = [];

async function createRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'blog-independent-assets-'));
  temporaryDirectories.push(root);
  await Promise.all([
    mkdir(join(root, 'blog'), { recursive: true }),
    mkdir(join(root, 'clips'), { recursive: true }),
    mkdir(join(root, 'images'), { recursive: true }),
  ]);
  return root;
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((root) => rm(root, {
    recursive: true,
    force: true,
  })));
});

function post(slug: string, body: string): PostDocument {
  return {
    slug,
    title: slug,
    description: slug,
    publishedAt: '2026-08-14',
    tags: [],
    draft: false,
    featured: false,
    body,
  };
}

describe('independent image assets', () => {
  it('uploads without an article slug and deduplicates by normalized content hash', async () => {
    const root = await createRoot();
    const service = new ImageService({ contentRoot: root });
    const sharp = (await import('sharp')).default;
    const source = await sharp({
      create: { width: 4, height: 4, channels: 3, background: '#c83d70' },
    }).png().toBuffer();

    const first = await service.upload({ originalName: 'Example image.png', bytes: source });
    const second = await service.upload({ originalName: 'Different name.png', bytes: source });

    expect(first.relativePath).toMatch(/^images\/example-image-[a-f0-9]{12}\.webp$/);
    expect(second.relativePath).toBe(first.relativePath);
    expect(first).not.toHaveProperty('ownerPostSlug');
  });
});

describe('independent reusable clips', () => {
  it('creates a clip without a post and discovers references from multiple posts', async () => {
    const root = await createRoot();
    const repository = createContentRepository({ root });

    await repository.createClip('shared-answer', {
      title: 'Shared answer',
      description: 'Reusable source.',
      language: 'typescript',
      file: 'answer.ts',
      createdAt: '2026-08-14',
    }, 'export const answer = 42;\n');
    await repository.createPost(post('first', '```clip\nslug: shared-answer\n```\n'));
    await repository.createPost(post('second', '```clip\nslug: shared-answer\n```\n'));

    const clip = await repository.readClip('shared-answer');
    expect(clip.references).toEqual([
      { postSlug: 'first', kind: 'body' },
      { postSlug: 'second', kind: 'body' },
    ]);
    expect(clip.metadataRevision).toMatch(/^[a-f0-9]{64}$/);
    expect(clip.codeRevision).toMatch(/^[a-f0-9]{64}$/);
    await expect(readFile(join(root, 'clips', 'shared-answer', 'meta.json'), 'utf8'))
      .resolves.toContain('"version": 1');
  });

  it('keeps an unreferenced clip valid and blocks deletion after it is referenced', async () => {
    const root = await createRoot();
    const repository = createContentRepository({ root });
    await repository.createClip('standalone', {
      title: 'Standalone',
      language: 'cpp',
      file: 'main.cpp',
      createdAt: '2026-08-14',
    }, 'int main() {}\n');

    expect((await repository.readClip('standalone')).references).toEqual([]);
    await repository.createPost(post('owner', '```clip\nslug: standalone\n```\n'));
    await expect(repository.deleteClip('standalone')).rejects.toMatchObject({
      code: 'CONTENT_CONFLICT',
    });
  });

  it('rejects article references to missing clips', async () => {
    const root = await createRoot();
    const repository = createContentRepository({ root });
    await repository.createPost(post('broken', '```clip\nslug: missing\n```\n'));
    await expect(repository.listClips()).rejects.toThrow(/missing clip/i);
  });
});
