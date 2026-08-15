import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { migrateAdminDatabase } from '../admin/server/db/migrations';

const databases: DatabaseSync[] = [];

function createDatabase(): DatabaseSync {
  const database = new DatabaseSync(':memory:');
  databases.push(database);
  return database;
}

afterEach(() => {
  while (databases.length > 0) {
    databases.pop()?.close();
  }
});

describe('admin SQLite migrations', () => {
  it('creates the complete version-three state schema idempotently', () => {
    const database = createDatabase();

    migrateAdminDatabase(database);
    migrateAdminDatabase(database);

    const tables = database
      .prepare(`
        SELECT name
        FROM sqlite_master
        WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `)
      .all()
      .map((row) => String(row.name));

    expect(tables).toEqual([
      'admin_setup_challenges',
      'admin_setup_tokens',
      'admins',
      'api_tokens',
      'audit_logs',
      'login_attempts',
      'publish_jobs',
      'recovery_codes',
      'revisions',
      'schema_migrations',
      'sessions',
    ]);
    expect(database.prepare('PRAGMA user_version').get()).toEqual({ user_version: 3 });
    expect(database.prepare('PRAGMA foreign_keys').get()).toEqual({ foreign_keys: 1 });
  });

  it('enforces a single administrator row at the database layer', () => {
    const database = createDatabase();
    migrateAdminDatabase(database);

    database
      .prepare(`
        INSERT INTO admins (id, username, password_hash, totp_secret_encrypted, created_at, updated_at)
        VALUES (1, 'owner', 'password-hash', 'encrypted-secret', 1, 1)
      `)
      .run();

    expect(() => {
      database
        .prepare(`
          INSERT INTO admins (id, username, password_hash, totp_secret_encrypted, created_at, updated_at)
          VALUES (2, 'other', 'password-hash', 'encrypted-secret', 1, 1)
        `)
        .run();
    }).toThrow();
  });

  it('creates the API token lifecycle columns without storing plaintext tokens', () => {
    const database = createDatabase();
    migrateAdminDatabase(database);

    const columns = database
      .prepare('PRAGMA table_info(api_tokens)')
      .all()
      .map((row) => String(row.name));

    expect(columns).toEqual([
      'id',
      'name',
      'token_prefix',
      'token_hash',
      'scopes_json',
      'created_at',
      'expires_at',
      'last_used_at',
      'revoked_at',
    ]);
    expect(columns).not.toContain('token');
  });

  it('provides the required revision and publish job foundations', () => {
    const database = createDatabase();
    migrateAdminDatabase(database);

    const revisionColumns = database
      .prepare('PRAGMA table_info(revisions)')
      .all()
      .map((row) => String(row.name));
    const publishJobColumns = database
      .prepare('PRAGMA table_info(publish_jobs)')
      .all()
      .map((row) => String(row.name));

    expect(revisionColumns).toEqual(expect.arrayContaining([
      'id',
      'content_path',
      'revision_number',
      'content_sha256',
      'content',
      'created_by_admin_id',
      'created_at',
    ]));
    expect(publishJobColumns).toEqual(expect.arrayContaining([
      'id',
      'revision_id',
      'status',
      'requested_by_admin_id',
      'created_at',
      'started_at',
      'finished_at',
      'error_message',
    ]));
  });
});
