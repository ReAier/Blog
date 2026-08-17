import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterEach, describe, expect, it } from 'vitest';
import { buildServer } from '../admin/server/app';
import { createAdminConfig } from '../admin/server/config';
import { createContentRepository } from '../admin/server/content/repository';
import { migrateAdminDatabase } from '../admin/server/db/migrations';
import { ImageService } from '../admin/server/images/service';
import { validateContentRoot } from '../admin/server/publish/runner';

const roots: string[] = [];
const writeHeaders = {
  origin: 'https://admin.blog.reaier.top',
  'x-csrf-token': 'csrf',
};

afterEach(async () => {
  sharp.cache(false);
  await Promise.all(roots.splice(0).map((path) => rm(path, { recursive: true, force: true })));


});

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'admin-unified-trash-'));
  roots.push(root);
  const contentRoot = join(root, 'content');
  for (const name of ['blog', 'clips', 'images']) await mkdir(join(contentRoot, name), { recursive: true });
  const repository = createContentRepository({ root: contentRoot });
  await repository.createClip('shared-clip', {
    title: 'Shared clip',
    language: 'typescript',
    file: 'shared.ts',
    createdAt: '2026-08-17',
  }, 'export const shared = true;\n');
  const image = await new ImageService({ contentRoot }).upload({
    originalName: 'shared.png',
    bytes: await sharp({
      create: { width: 2, height: 2, channels: 3, background: '#663399' },
    }).png().toBuffer(),
  });
  await repository.createPost({
    slug: 'owner',
    title: 'Owner',
    description: 'Owner post',
    publishedAt: '2026-08-17',
    tags: [],
    draft: false,
    featured: false,
    cover: `../${image.relativePath}`,
    body: `\`\`\`clip\nslug: shared-clip\n\`\`\`\n\n![shared](../${image.relativePath})\n`,
  });
  const database = new DatabaseSync(':memory:');
  migrateAdminDatabase(database);
  const config = createAdminConfig({
    contentRoot,
    dataRoot: root,
    projectRoot: process.cwd(),
    publicOrigin: 'https://admin.blog.reaier.top',
    secureCookies: false,
  });
  const app = await buildServer({
    config,
    database,
    repository,
    authOverride: async () => ({ adminId: 1, username: 'owner', csrfToken: 'csrf' }),
  });
  return { app, config, contentRoot, database, image, repository, root };
}

describe('unified content trash', () => {
  it('moves referenced posts, clips, and images into one recoverable trash list', async () => {
    const { app, database, image } = await fixture();
    const post = await app.inject({ method: 'GET', url: '/api/posts/owner' });

    const clipDelete = await app.inject({
      method: 'DELETE',
      url: '/api/clips/shared-clip',
      headers: writeHeaders,
    });
    expect(clipDelete.statusCode, clipDelete.body).toBe(200);

    const imageId = Buffer.from(image.relativePath.replace(/^images\//, ''), 'utf8').toString('base64url');
    const imageDelete = await app.inject({
      method: 'DELETE',
      url: `/api/images/${encodeURIComponent(imageId)}`,
      headers: writeHeaders,
    });
    expect(imageDelete.statusCode, imageDelete.body).toBe(200);

    const postDelete = await app.inject({
      method: 'DELETE',
      url: '/api/posts/owner',
      headers: { ...writeHeaders, 'if-match': post.json().revision },
    });
    expect(postDelete.statusCode, postDelete.body).toBe(200);

    const trash = await app.inject({ method: 'GET', url: '/api/trash' });
    expect(trash.statusCode, trash.body).toBe(200);
    expect(trash.json().items).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'post', title: 'Owner' }),
      expect.objectContaining({ type: 'clip', title: 'Shared clip' }),
      expect.objectContaining({ type: 'image', title: expect.stringContaining('shared') }),
    ]));

    for (const item of trash.json().items as Array<{ id: string; type: string }>) {
      const restored = await app.inject({
        method: 'POST',
        url: `/api/trash/${item.type}/${encodeURIComponent(item.id)}/restore`,
        headers: writeHeaders,
      });
      expect(restored.statusCode, restored.body).toBe(200);
    }

    expect((await app.inject({ method: 'GET', url: '/api/posts/owner' })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/api/clips/shared-clip' })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/api/images' })).json().total).toBe(1);
    expect((await app.inject({ method: 'GET', url: '/api/trash' })).json().items).toEqual([]);

    await app.close();
    database.close();
  });

  it('reports all broken local image and clip references during publish validation', async () => {
    const { app, contentRoot, database, image } = await fixture();
    const imageId = Buffer.from(image.relativePath.replace(/^images\//, ''), 'utf8').toString('base64url');
    await app.inject({ method: 'DELETE', url: '/api/clips/shared-clip', headers: writeHeaders });
    await app.inject({ method: 'DELETE', url: `/api/images/${encodeURIComponent(imageId)}`, headers: writeHeaders });

    await expect(validateContentRoot({
      contentRoot,
      outputPath: join(contentRoot, 'redirects.conf'),
    })).rejects.toThrow(/owner[\s\S]*shared-clip[\s\S]*missing image/i);

    await app.close();
    database.close();
  });

  it('permanently deletes posts, clips, and images from trash', async () => {
    const { app, database, image } = await fixture();
    const post = await app.inject({ method: 'GET', url: '/api/posts/owner' });
    const imageId = Buffer.from(image.relativePath.replace(/^images\//, ''), 'utf8').toString('base64url');
    await app.inject({ method: 'DELETE', url: '/api/clips/shared-clip', headers: writeHeaders });
    await app.inject({ method: 'DELETE', url: `/api/images/${encodeURIComponent(imageId)}`, headers: writeHeaders });
    await app.inject({
      method: 'DELETE',
      url: '/api/posts/owner',
      headers: { ...writeHeaders, 'if-match': post.json().revision },
    });

    const trash = (await app.inject({ method: 'GET', url: '/api/trash' })).json().items as Array<{
      id: string;
      type: string;
    }>;
    expect(trash).toHaveLength(3);
    for (const item of trash) {
      const removed = await app.inject({
        method: 'DELETE',
        url: `/api/trash/${item.type}/${encodeURIComponent(item.id)}`,
        headers: writeHeaders,
      });
      expect(removed.statusCode, removed.body).toBe(200);
    }

    expect((await app.inject({ method: 'GET', url: '/api/trash' })).json().items).toEqual([]);
    expect((await app.inject({ method: 'GET', url: '/api/posts/owner' })).statusCode).toBe(404);
    expect((await app.inject({ method: 'GET', url: '/api/clips/shared-clip' })).statusCode).toBe(404);
    expect((await app.inject({ method: 'GET', url: '/api/images' })).json().total).toBe(0);

    await app.close();
    database.close();
  });

});
