import { DatabaseSync } from 'node:sqlite';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterEach, describe, expect, it } from 'vitest';
import { buildServer } from '../admin/server/app';
import { createApiToken } from '../admin/server/auth/api-tokens';
import { createAdminConfig } from '../admin/server/config';
import { createContentRepository } from '../admin/server/content/repository';
import { migrateAdminDatabase } from '../admin/server/db/migrations';

const roots: string[] = [];

afterEach(async () => {
  sharp.cache(false);
  await Promise.all(roots.splice(0).map((path) => rm(path, { recursive: true, force: true, maxRetries: 2, retryDelay: 50 })));
});

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'admin-api-v1-'));
  roots.push(root);
  const contentRoot = join(root, 'content');
  for (const name of ['blog', 'clips', 'images']) {
    await mkdir(join(contentRoot, name), { recursive: true });
  }
  const markdown = [
    '---',
    'title: Existing',
    'description: Existing description',
    'publishedAt: 2026-08-15',
    'tags: []',
    'draft: true',
    'featured: false',
    '---',
    '',
    'Existing body',
    '',
  ].join('\n');
  await writeFile(join(contentRoot, 'blog', 'existing.md'), markdown);
  const database = new DatabaseSync(':memory:');
  migrateAdminDatabase(database);
  const app = await buildServer({
    config: createAdminConfig({
      contentRoot,
      dataRoot: root,
      publicOrigin: 'https://admin.blog.reaier.top',
      secureCookies: false,
    }),
    database,
    repository: createContentRepository({ root: contentRoot }),
  });
  return { app, database };
}

function bearer(token: string) {
  return { authorization: `Bearer ${token}` };
}

describe('AI REST API v1 posts', () => {
  it('requires a valid Bearer token and the route scope', async () => {
    const { app, database } = await fixture();
    const missing = await app.inject({ method: 'GET', url: '/api/v1/posts' });
    expect(missing.statusCode).toBe(401);
    expect(missing.json()).toMatchObject({ code: 'API_TOKEN_REQUIRED' });

    const clipToken = createApiToken(database, {
      name: 'Clip reader',
      scopes: ['clips:read'],
      expiresInDays: 30,
    }).token;
    const forbidden = await app.inject({
      method: 'GET',
      url: '/api/v1/posts',
      headers: bearer(clipToken),
    });
    expect(forbidden.statusCode).toBe(403);
    expect(forbidden.json()).toMatchObject({ code: 'API_SCOPE_REQUIRED' });
    await app.close();
    database.close();
  });

  it('lists posts and forces AI-created posts to remain unpublished drafts', async () => {
    const { app, database } = await fixture();
    const token = createApiToken(database, {
      name: 'Post writer',
      scopes: ['posts:read', 'posts:write'],
      expiresInDays: 30,
    }).token;

    const listed = await app.inject({
      method: 'GET',
      url: '/api/v1/posts',
      headers: bearer(token),
    });
    expect(listed.statusCode).toBe(200);
    expect(listed.json()).toMatchObject({ items: [{ slug: 'existing' }], total: 1 });

    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/posts',
      headers: bearer(token),
      payload: {
        slug: 'ai-draft',
        title: 'AI Draft',
        description: 'Generated but not published',
        publishedAt: '2026-08-15',
        tags: ['AI'],
        draft: false,
        featured: true,
        body: '# Draft\n',
      },
    });
    expect(created.statusCode, created.body).toBe(201);
    expect(created.json()).toMatchObject({
      slug: 'ai-draft',
      draft: true,
      featured: false,
      revision: expect.any(String),
    });
    await app.close();
    database.close();
  });

  it('requires If-Match and prevents updates from changing publication state or slug', async () => {
    const { app, database } = await fixture();
    const token = createApiToken(database, {
      name: 'Post writer',
      scopes: ['posts:read', 'posts:write'],
      expiresInDays: 30,
    }).token;
    const current = await app.inject({
      method: 'GET',
      url: '/api/v1/posts/existing',
      headers: bearer(token),
    });

    const payload = {
      slug: 'renamed-by-ai',
      title: 'Updated by AI',
      description: 'Updated description',
      publishedAt: '2026-08-15',
      tags: ['updated'],
      draft: false,
      featured: true,
      body: 'Updated body\n',
    };
    const missingRevision = await app.inject({
      method: 'PUT',
      url: '/api/v1/posts/existing',
      headers: bearer(token),
      payload,
    });
    expect(missingRevision.statusCode).toBe(428);
    expect(missingRevision.json()).toMatchObject({ code: 'PRECONDITION_REQUIRED' });

    const updated = await app.inject({
      method: 'PUT',
      url: '/api/v1/posts/existing',
      headers: { ...bearer(token), 'if-match': current.json().revision },
      payload,
    });
    expect(updated.statusCode, updated.body).toBe(200);
    expect(updated.json()).toMatchObject({
      slug: 'existing',
      title: 'Updated by AI',
      draft: true,
      featured: false,
    });
    await app.close();
    database.close();
  });
});


describe('AI REST API v1 clips', () => {
  it('creates, reads and updates independent clips with scope and revision checks', async () => {
    const { app, database } = await fixture();
    const token = createApiToken(database, {
      name: 'Clip writer',
      scopes: ['clips:read', 'clips:write'],
      expiresInDays: 30,
    }).token;

    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/clips',
      headers: bearer(token),
      payload: {
        slug: 'ai-helper',
        title: 'AI helper',
        description: '',
        language: 'typescript',
        file: 'ai-helper.ts',
        createdAt: '2026-08-15',
        code: 'export const value = 1;\n',
      },
    });
    expect(created.statusCode, created.body).toBe(201);
    expect(created.json()).toMatchObject({
      slug: 'ai-helper',
      references: [],
      revision: expect.any(String),
    });

    const listed = await app.inject({
      method: 'GET',
      url: '/api/v1/clips',
      headers: bearer(token),
    });
    expect(listed.statusCode).toBe(200);
    expect(listed.json()).toMatchObject({ items: [{ slug: 'ai-helper' }], total: 1 });

    const updatePayload = {
      slug: 'renamed',
      title: 'Updated helper',
      description: 'Updated',
      language: 'typescript',
      file: 'renamed.ts',
      createdAt: '2026-08-15',
      code: 'export const value = 2;\n',
    };
    const missingRevision = await app.inject({
      method: 'PUT',
      url: '/api/v1/clips/ai-helper',
      headers: bearer(token),
      payload: updatePayload,
    });
    expect(missingRevision.statusCode).toBe(428);

    const updated = await app.inject({
      method: 'PUT',
      url: '/api/v1/clips/ai-helper',
      headers: { ...bearer(token), 'if-match': created.json().revision },
      payload: updatePayload,
    });
    expect(updated.statusCode, updated.body).toBe(200);
    expect(updated.json()).toMatchObject({
      slug: 'ai-helper',
      file: 'ai-helper.ts',
      title: 'Updated helper',
      code: 'export const value = 2;\n',
    });
    await app.close();
    database.close();
  });
});

// Image API uses multipart uploads because binary data should not be embedded in JSON.
describe('AI REST API v1 images', () => {
  it('lists and uploads images with image scopes', async () => {
    const { app, database } = await fixture();
    const token = createApiToken(database, {
      name: 'Image writer',
      scopes: ['images:read', 'images:write'],
      expiresInDays: 30,
    }).token;
    const png = await sharp({
      create: {
        width: 1,
        height: 1,
        channels: 4,
        background: '#ff0000',
      },
    }).png().toBuffer();
    const boundary = '----aier-v1-image';
    const payload = Buffer.concat([
      Buffer.from([
        `--${boundary}`,
        'Content-Disposition: form-data; name="file"; filename="pixel.png"',
        'Content-Type: image/png',
        '',
        '',
      ].join('\r\n')),
      png,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);

    const uploaded = await app.inject({
      method: 'POST',
      url: '/api/v1/images',
      headers: {
        ...bearer(token),
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload,
    });
    expect(uploaded.statusCode, uploaded.body).toBe(201);
    expect(uploaded.json()).toMatchObject({
      originalName: expect.stringContaining('pixel'),
      markdownPath: expect.stringMatching(/^\.\.\/images\//),
      width: 1,
      height: 1,
    });

    const listed = await app.inject({
      method: 'GET',
      url: '/api/v1/images',
      headers: bearer(token),
    });
    expect(listed.statusCode).toBe(200);
    expect(listed.json()).toMatchObject({ items: [{ id: uploaded.json().id }], total: 1 });
    await app.close();
    database.close();
  });
});






describe('AI REST API v1 OpenAPI', () => {
  it('serves authenticated OpenAPI 3.1 documentation without destructive or publish operations', async () => {
    const { app, database } = await fixture();
    const token = createApiToken(database, {
      name: 'Documentation reader',
      scopes: ['posts:read'],
      expiresInDays: 30,
    }).token;

    const missing = await app.inject({ method: 'GET', url: '/api/v1/openapi.json' });
    expect(missing.statusCode).toBe(401);

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/openapi.json',
      headers: bearer(token),
    });
    expect(response.statusCode, response.body).toBe(200);
    const document = response.json();
    expect(document).toMatchObject({
      openapi: '3.1.0',
      info: { title: 'Aier Blog AI API', version: '1.0.0' },
      components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer' } } },
    });
    expect(Object.keys(document.paths)).toEqual(expect.arrayContaining([
      '/api/v1/posts',
      '/api/v1/posts/{slug}',
      '/api/v1/clips',
      '/api/v1/clips/{slug}',
      '/api/v1/images',
    ]));
    expect(Object.keys(document.paths).join(' ')).not.toMatch(/publish|backup|restore/i);
    for (const pathItem of Object.values(document.paths) as Array<Record<string, unknown>>) {
      expect(pathItem).not.toHaveProperty('delete');
    }
    await app.close();
    database.close();
  });
});
