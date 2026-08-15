import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildServer } from '../admin/server/app';
import { generateTotp } from '../admin/server/auth/totp';
import { prepareAdminSetup } from '../admin/server/auth/setup';
import { createAdminConfig } from '../admin/server/config';
import { createContentRepository } from '../admin/server/content/repository';

const roots: string[] = [];
const origin = 'https://admin.blog.reaier.top';
const masterKey = Buffer.alloc(32, 23);

afterEach(async () => {
  await Promise.all(roots.splice(0).map((path) => rm(path, {
    recursive: true,
    force: true,
  })));
});

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'admin-setup-api-'));
  roots.push(root);
  const contentRoot = join(root, 'content');
  for (const name of ['blog', 'clips', 'images']) {
    await mkdir(join(contentRoot, name), { recursive: true });
  }
  const database = new DatabaseSync(':memory:');
  const config = createAdminConfig({
    contentRoot,
    dataRoot: root,
    publicOrigin: origin,
    secureCookies: false,
    masterKey,
  });
  const app = await buildServer({
    config,
    database,
    repository: createContentRepository({ root: contentRoot }),
  });
  return { app, config, database };
}

describe('first-run administrator setup API', () => {
  it('exposes only a minimal public status before initialization', async () => {
    const { app, database } = await fixture();

    const status = await app.inject({
      method: 'GET',
      url: '/api/auth/setup/status',
    });

    expect(status.statusCode).toBe(200);
    expect(status.json()).toEqual({ required: true, tokenReady: false });
    expect((await app.inject({
      method: 'POST',
      url: '/api/auth/register',
    })).statusCode).toBe(404);
    await app.close();
    database.close();
  });

  it('requires the exact configured origin for setup writes', async () => {
    const { app, database } = await fixture();
    const prepared = prepareAdminSetup(database, { encryptionKey: masterKey });

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/setup/begin',
      headers: { origin: 'https://attacker.example' },
      payload: {
        token: prepared.token,
        username: 'owner',
        password: 'correct horse battery staple',
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ code: 'SETUP_ORIGIN_REJECTED' });
    await app.close();
    database.close();
  });

  it('creates the administrator, returns recovery codes and starts a session', async () => {
    const { app, database } = await fixture();
    const prepared = prepareAdminSetup(database, { encryptionKey: masterKey });

    const begun = await app.inject({
      method: 'POST',
      url: '/api/auth/setup/begin',
      headers: { origin },
      payload: {
        token: prepared.token,
        username: 'owner',
        password: 'correct horse battery staple',
      },
    });
    expect(begun.statusCode, begun.body).toBe(200);
    expect(begun.json()).toMatchObject({
      challenge: expect.any(String),
      totpSecret: expect.any(String),
      otpauthUri: expect.stringContaining('otpauth://totp/'),
      expiresAt: expect.any(Number),
    });

    const confirmation = await app.inject({
      method: 'POST',
      url: '/api/auth/setup/confirm',
      headers: { origin },
      payload: {
        challenge: begun.json().challenge,
        totpCode: generateTotp(begun.json().totpSecret, Date.now()),
      },
    });
    expect(confirmation.statusCode, confirmation.body).toBe(201);
    expect(confirmation.headers['set-cookie']).toContain('aier_admin=');
    expect(confirmation.headers['set-cookie']).toContain('HttpOnly');
    expect(confirmation.headers['set-cookie']).toContain('SameSite=Strict');
    expect(confirmation.json()).toMatchObject({
      username: 'owner',
      csrfToken: expect.any(String),
      recoveryCodes: expect.arrayContaining([expect.any(String)]),
    });
    expect(confirmation.json().recoveryCodes).toHaveLength(10);

    const closed = await app.inject({
      method: 'POST',
      url: '/api/auth/setup/begin',
      headers: { origin },
      payload: {
        token: prepared.token,
        username: 'another',
        password: 'another strong password',
      },
    });
    expect(closed.statusCode).toBe(409);
    expect(closed.json()).toMatchObject({ code: 'SETUP_ALREADY_COMPLETED' });
    await app.close();
    database.close();
  });
});
