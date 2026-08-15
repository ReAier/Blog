import { buildServer } from '../admin/server/app';
import { createAdminConfig } from '../admin/server/config';
import { createContentRepository } from '../admin/server/content/repository';
import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { migrateAdminDatabase } from '../admin/server/db/migrations';

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((path) => rm(path, { recursive: true, force: true }))));

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'admin-api-')); roots.push(root);
  const contentRoot = join(root, 'content');
  for (const name of ['blog', 'clips', 'images']) await mkdir(join(contentRoot, name), { recursive: true });
  await writeFile(join(contentRoot, 'blog', 'hello.md'), `---\ntitle: Hello\ndescription: World\npublishedAt: 2026-08-13\ntags: []\ndraft: true\nfeatured: false\n---\n\nBody\n`);
  const database = new DatabaseSync(':memory:'); migrateAdminDatabase(database);
  const app = await buildServer({
    config: createAdminConfig({ contentRoot, dataRoot: root, publicOrigin: 'https://admin.blog.reaier.top', secureCookies: false }),
    database,
    repository: createContentRepository({ root: contentRoot }),
    authOverride: async () => ({ adminId: 1, username: 'owner', csrfToken: 'csrf' }),
  });
  return { app, database };
}

function multipartMarkdown(fileName: string, markdown: string) {
  const boundary = '----blog-admin-test';
  return {
    boundary,
    payload: [
      `--${boundary}`,
      `Content-Disposition: form-data; name="file"; filename="${fileName}"`,
      'Content-Type: text/markdown',
      '',
      markdown,
      `--${boundary}--`,
      '',
    ].join('\r\n'),
  };
}
describe('admin API', () => {
  it('has no registration endpoint and applies security headers', async () => {
    const { app, database } = await fixture();
    const register = await app.inject({ method: 'POST', url: '/api/auth/register' });
    const health = await app.inject({ method: 'GET', url: '/api/health' });
    expect(register.statusCode).toBe(404);
    expect(health.statusCode).toBe(200);
    expect(health.headers['content-security-policy']).toContain("frame-ancestors 'none'");
    await app.close(); database.close();
  });


  it('returns a stable error contract without leaking unexpected exception messages', async () => {
    const { app, database } = await fixture();
    app.get('/api/test/internal-error', async () => {
      throw new Error('database-password=super-secret');
    });

    const response = await app.inject({ method: 'GET', url: '/api/test/internal-error' });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toMatchObject({
      code: 'INTERNAL_ERROR',
      message: 'Unexpected server error.',
    });
    expect(response.json().requestId).toEqual(expect.any(String));
    expect(response.body).not.toContain('database-password');
    await app.close();
    database.close();
  });

  it('adds a request ID to policy errors returned outside the error handler', async () => {
    const { app, database } = await fixture();
    const response = await app.inject({ method: 'POST', url: '/api/publish' });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ code: 'CSRF_REJECTED' });
    expect(response.json().requestId).toEqual(expect.any(String));
    await app.close();
    database.close();
  });

  it('validates JSON route input and returns the shared validation error contract', async () => {
    const { app, database } = await fixture();
    const response = await app.inject({
      method: 'POST',
      url: '/api/posts',
      headers: {
        origin: 'https://admin.blog.reaier.top',
        'x-csrf-token': 'csrf',
      },
      payload: { title: 'Missing required post fields' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'The request did not match the API schema.',
    });
    expect(response.json().details).toEqual(expect.any(Array));
    expect(response.json().requestId).toEqual(expect.any(String));
    await app.close();
    database.close();
  });

  it('normalizes code-only route errors with a message and request ID', async () => {
    const { app, database } = await fixture();
    const response = await app.inject({ method: 'GET', url: '/api/publish/missing-job' });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({
      code: 'JOB_NOT_FOUND',
      message: 'Request failed.',
    });
    expect(response.json().requestId).toEqual(expect.any(String));
    await app.close();
    database.close();
  });

  it('creates, lists and revokes scoped API tokens without returning plaintext again', async () => {
    const { app, database } = await fixture();
    const headers = {
      origin: 'https://admin.blog.reaier.top',
      'x-csrf-token': 'csrf',
    };
    const created = await app.inject({
      method: 'POST',
      url: '/api/auth/tokens',
      headers,
      payload: {
        name: 'AI writer',
        scopes: ['posts:read', 'posts:write'],
        expiresInDays: 30,
      },
    });

    expect(created.statusCode, created.body).toBe(201);
    expect(created.json()).toMatchObject({
      token: expect.stringMatching(/^aier_pat_/),
      record: { name: 'AI writer', scopes: ['posts:read', 'posts:write'] },
    });

    const listed = await app.inject({ method: 'GET', url: '/api/auth/tokens' });
    expect(listed.statusCode).toBe(200);
    expect(listed.json()).toMatchObject([{ id: created.json().record.id, name: 'AI writer' }]);
    expect(listed.body).not.toContain(created.json().token);

    const revoked = await app.inject({
      method: 'DELETE',
      url: `/api/auth/tokens/${created.json().record.id}`,
      headers,
    });
    expect(revoked.statusCode).toBe(200);
    expect(revoked.json()).toEqual(expect.objectContaining({ ok: true }));
    await app.close();
    database.close();
  });

  it('lists posts and rejects stale revisions with 409', async () => {
    const { app, database } = await fixture();
    const listed = await app.inject({ method: 'GET', url: '/api/posts' });
    expect(listed.statusCode).toBe(200);
    expect(listed.json()).toMatchObject({ items: [{ slug: 'hello', title: 'Hello' }], total: 1 });
    const update = await app.inject({
      method: 'PATCH', url: '/api/posts/hello',
      headers: { origin: 'https://admin.blog.reaier.top', 'x-csrf-token': 'csrf' },
      payload: { title: 'Changed', description: 'World', publishedAt: '2026-08-13', tags: [], draft: true, featured: false, body: 'Body', expectedRevision: 'stale' },
    });
    expect(update.statusCode).toBe(409);
    expect(update.json()).toMatchObject({ code: 'REVISION_CONFLICT' });
    await app.close(); database.close();
  });

  it('imports plain Markdown by generating stored frontmatter', async () => {
    const { app, database } = await fixture();
    const upload = multipartMarkdown('Imported Note.md', '# Imported note\n\nImported summary.\n');
    const response = await app.inject({
      method: 'POST',
      url: '/api/posts/import',
      headers: {
        origin: 'https://admin.blog.reaier.top',
        'x-csrf-token': 'csrf',
        'content-type': `multipart/form-data; boundary=${upload.boundary}`,
      },
      payload: upload.payload,
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      slug: 'imported-note',
      title: 'Imported note',
      description: 'Imported summary.',
      draft: true,
    });
    await app.close();
    database.close();
  });
});
