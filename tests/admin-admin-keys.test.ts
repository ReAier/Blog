import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import {
  adminRolePermissions,
  createAdminKey,
  resolveAdminKey,
  updateAdminKey,
  revokeAdminKey,
} from '../admin/server/auth/admin-keys';
import { migrateAdminDatabase } from '../admin/server/db/migrations';

const databases: DatabaseSync[] = [];

function databaseFixture() {
  const database = new DatabaseSync(':memory:');
  databases.push(database);
  migrateAdminDatabase(database, Date.UTC(2026, 7, 18));
  return database;
}

afterEach(() => {
  while (databases.length) databases.pop()?.close();
});

describe('admin keys', () => {
  it('creates an er-prefixed 256-bit key and stores only its hash', () => {
    const database = databaseFixture();
    const created = createAdminKey(database, {
      name: 'Primary owner',
      role: 'owner',
      permissions: [...adminRolePermissions.owner],
      expiresInDays: null,
    }, Date.UTC(2026, 7, 18));

    expect(created.key).toMatch(/^er-[A-Za-z0-9_-]{43}$/);
    expect(created.record.expiresAt).toBeUndefined();
    expect(database.prepare('SELECT key_hash FROM admin_keys WHERE id = ?').get(created.record.id))
      .not.toEqual({ key_hash: created.key });
    expect(JSON.stringify(database.prepare('SELECT * FROM admin_keys').get())).not.toContain(created.key);
  });

  it('supports bounded expiry and live permission updates and revocation', () => {
    const database = databaseFixture();
    const now = Date.UTC(2026, 7, 18);
    const created = createAdminKey(database, {
      name: 'Editor',
      role: 'editor',
      permissions: ['dashboard:read', 'posts:read'],
      expiresInDays: 7,
    }, now);

    expect(resolveAdminKey(database, created.key, now + 1)).toMatchObject({
      id: created.record.id,
      permissions: ['dashboard:read', 'posts:read'],
      expiresAt: now + 7 * 86_400_000,
    });
    updateAdminKey(database, created.record.id, {
      role: 'custom',
      permissions: ['posts:read'],
    });
    expect(resolveAdminKey(database, created.key, now + 3)?.permissions).toEqual(['posts:read']);
    revokeAdminKey(database, created.record.id, now + 4);
    expect(resolveAdminKey(database, created.key, now + 5)).toBeNull();
  });

  it('rejects AI and legacy token prefixes', () => {
    const database = databaseFixture();
    expect(resolveAdminKey(database, 'ai-not-an-admin-key')).toBeNull();
    expect(resolveAdminKey(database, 'aier_pat_legacy')).toBeNull();
  });
});

