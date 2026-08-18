import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildServer } from '../admin/server/app';
import { createAdminConfig } from '../admin/server/config';
const roots: string[] = [];
afterEach(async () => { while (roots.length) await rm(roots.pop()!, { recursive: true, force: true }); });
describe('removed first-run setup API', () => {
  it('does not expose password or TOTP setup routes', async () => {
    const root = await mkdtemp(join(tmpdir(), 'removed-admin-setup-')); roots.push(root);
    const contentRoot = join(root, 'content'); for (const dir of ['blog','clips','images']) await mkdir(join(contentRoot, dir), { recursive: true });
    const database = new DatabaseSync(':memory:');
    const app = await buildServer({ database, config: createAdminConfig({ projectRoot: process.cwd(), contentRoot, dataRoot: join(root,'data'), statePath: join(root,'state.sqlite'), historyRoot: join(root,'history'), trashRoot: join(root,'trash'), jobsRoot: join(root,'jobs'), previewsRoot: join(root,'previews'), clientRoot: join(root,'missing'), publicOrigin: 'https://admin.example.com', secureCookies: false }) });
    for (const url of ['/api/auth/setup/status', '/api/auth/setup/begin', '/api/auth/setup/confirm', '/api/auth/security/rotate']) {
      expect((await app.inject({ method: url.endsWith('status') ? 'GET' : 'POST', url })).statusCode).toBe(404);
    }
    await app.close(); database.close();
  });
});
