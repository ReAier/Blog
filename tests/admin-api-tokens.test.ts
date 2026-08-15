import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import {
  authenticateApiToken,
  createApiToken,
  listApiTokens,
  revokeApiToken,
} from '../admin/server/auth/api-tokens';
import { migrateAdminDatabase } from '../admin/server/db/migrations';

const databases: DatabaseSync[] = [];

function databaseFixture() {
  const database = new DatabaseSync(':memory:');
  databases.push(database);
  migrateAdminDatabase(database, Date.UTC(2026, 7, 15));
  return database;
}

afterEach(() => {
  while (databases.length) databases.pop()?.close();
});

describe('API tokens', () => {
  it('creates a 256-bit personal access token and stores only its hash', () => {
    const database = databaseFixture();
    const created = createApiToken(database, {
      name: 'Claude draft writer',
      scopes: ['posts:read', 'posts:write'],
      expiresInDays: 30,
    }, Date.UTC(2026, 7, 15));

    expect(created.token).toMatch(/^aier_pat_[A-Za-z0-9_-]{43}$/);
    expect(created.record).toMatchObject({
      name: 'Claude draft writer',
      scopes: ['posts:read', 'posts:write'],
      expiresAt: Date.UTC(2026, 8, 14),
      revokedAt: undefined,
    });
    const row = database.prepare('SELECT * FROM api_tokens WHERE id = ?').get(created.record.id);
    expect(row?.token_hash).not.toBe(created.token);
    expect(JSON.stringify(row)).not.toContain(created.token);
  });

  it('authenticates required scopes, updates last use and rejects revoked or expired tokens', () => {
    const database = databaseFixture();
    const now = Date.UTC(2026, 7, 15);
    const created = createApiToken(database, {
      name: 'Writer',
      scopes: ['posts:read', 'posts:write'],
      expiresInDays: 1,
    }, now);

    expect(authenticateApiToken(database, created.token, 'posts:write', now + 1_000)).toMatchObject({
      id: created.record.id,
      name: 'Writer',
    });
    expect(listApiTokens(database)[0]?.lastUsedAt).toBe(now + 1_000);
    expect(authenticateApiToken(database, created.token, 'clips:read', now + 2_000)).toBeNull();

    revokeApiToken(database, created.record.id, now + 3_000);
    expect(authenticateApiToken(database, created.token, 'posts:read', now + 4_000)).toBeNull();

    const expiring = createApiToken(database, {
      name: 'Short lived',
      scopes: ['images:read'],
      expiresInDays: 1,
    }, now);
    expect(authenticateApiToken(database, expiring.token, 'images:read', now + 86_400_000)).toBeNull();
  });

  it('rejects unknown scopes and expiry outside one to 365 days', () => {
    const database = databaseFixture();
    expect(() => createApiToken(database, {
      name: 'Invalid',
      scopes: ['publish:write' as 'posts:read'],
      expiresInDays: 30,
    })).toThrow(/scope/i);
    expect(() => createApiToken(database, {
      name: 'Invalid',
      scopes: ['posts:read'],
      expiresInDays: 366,
    })).toThrow(/365/);
  });
});
