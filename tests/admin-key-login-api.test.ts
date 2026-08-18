import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildServer } from '../admin/server/app';
import { adminRolePermissions, createAdminKey } from '../admin/server/auth/admin-keys';
import { createAdminConfig } from '../admin/server/config';
import { migrateAdminDatabase } from '../admin/server/db/migrations';

const roots: string[] = [];

afterEach(async () => {
  while (roots.length) await rm(roots.pop()!, { recursive: true, force: true });
});

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'admin-key-login-'));
  roots.push(root);
  const contentRoot = join(root, 'content');
  for (const dir of ['blog', 'clips', 'images']) {
    await mkdir(join(contentRoot, dir), { recursive: true });
  }
  await writeFile(
    join(contentRoot, 'blog', 'viewer-post.md'),
    '---\ntitle: Viewer post\ndescription: Read-only preview\npublishedAt: 2026-08-18\ntags: []\ndraft: false\nfeatured: false\n---\n\n# Rendered heading\n',
  );
  const database = new DatabaseSync(':memory:');
  migrateAdminDatabase(database);
  const created = createAdminKey(database, {
    name: 'Owner',
    role: 'owner',
    permissions: [...adminRolePermissions.owner],
    expiresInDays: null,
  });
  const viewer = createAdminKey(database, {
    name: 'Viewer',
    role: 'viewer',
    permissions: [...adminRolePermissions.viewer],
    expiresInDays: null,
  });
  const app = await buildServer({
    database,
    config: createAdminConfig({
      projectRoot: process.cwd(),
      contentRoot,
      dataRoot: join(root, 'data'),
      statePath: join(root, 'state.sqlite'),
      historyRoot: join(root, 'history'),
      trashRoot: join(root, 'trash'),
      jobsRoot: join(root, 'jobs'),
      previewsRoot: join(root, 'previews'),
      clientRoot: join(root, 'missing'),
      publicOrigin: 'https://admin.example.com',
      secureCookies: false,
    }),
  });
  return { app, database, created, viewer };
}

describe('admin key login API', () => {
  it('exchanges only an er key for a cookie session and exposes live permissions', async () => {
    const { app, database, created } = await fixture();
    expect((await app.inject({ method: 'POST', url: '/api/auth/login', payload: { key: 'ai-invalid' } })).statusCode).toBe(401);
    const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { key: created.key } });
    expect(login.statusCode).toBe(200);
    expect(login.headers['set-cookie']).toContain('HttpOnly');
    expect(login.json()).toMatchObject({
      id: created.record.id,
      role: 'owner',
      permissions: expect.arrayContaining(['admin-keys:create']),
    });
    const setCookie = login.headers['set-cookie'];
    const cookie = (Array.isArray(setCookie) ? setCookie[0] : setCookie)!.split(';')[0];
    const session = await app.inject({ method: 'GET', url: '/api/auth/session', headers: { cookie } });
    expect(session.statusCode).toBe(200);
    expect(session.json()).toMatchObject({ id: created.record.id, username: 'Owner' });
    await app.close();
    database.close();
  });

  it('renders a stored article for a viewer without granting instant-preview permission', async () => {
    const { app, database, viewer } = await fixture();
    const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { key: viewer.key } });
    const setCookie = login.headers['set-cookie'];
    const cookie = (Array.isArray(setCookie) ? setCookie[0] : setCookie)!.split(';')[0];

    const instant = await app.inject({
      method: 'POST',
      url: '/api/previews/instant',
      headers: {
        cookie,
        origin: 'https://admin.example.com',
        'x-csrf-token': login.json().csrfToken,
      },
      payload: { markdown: '# Arbitrary preview' },
    });
    expect(instant.statusCode).toBe(403);

    const stored = await app.inject({
      method: 'GET',
      url: '/api/posts/viewer-post/preview',
      headers: { cookie },
    });
    expect(stored.statusCode, stored.body).toBe(200);
    expect(stored.json().html).toContain('>Rendered heading</h1>');
    await app.close();
    database.close();
  });
});