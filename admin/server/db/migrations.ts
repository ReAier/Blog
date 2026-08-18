import type { DatabaseSync } from 'node:sqlite';

const migrationVersion = 4;

const versionOneMigrationSql = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    applied_at INTEGER NOT NULL
  ) STRICT;

  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    totp_secret_encrypted TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  ) STRICT;

  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    csrf_token_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    last_seen_at INTEGER NOT NULL,
    idle_expires_at INTEGER NOT NULL,
    absolute_expires_at INTEGER NOT NULL,
    revoked_at INTEGER
  ) STRICT;

  CREATE TABLE IF NOT EXISTS recovery_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
    code_hash TEXT NOT NULL UNIQUE,
    created_at INTEGER NOT NULL,
    used_at INTEGER
  ) STRICT;

  CREATE TABLE IF NOT EXISTS login_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    remote_address TEXT NOT NULL,
    succeeded INTEGER NOT NULL CHECK (succeeded IN (0, 1)),
    attempted_at INTEGER NOT NULL
  ) STRICT;

  CREATE INDEX IF NOT EXISTS login_attempts_lookup_idx
    ON login_attempts (username, remote_address, attempted_at DESC);

  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id INTEGER REFERENCES admins(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    details_json TEXT,
    remote_address TEXT,
    created_at INTEGER NOT NULL
  ) STRICT;

  CREATE TABLE IF NOT EXISTS revisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content_path TEXT NOT NULL,
    revision_number INTEGER NOT NULL,
    content_sha256 TEXT NOT NULL,
    content TEXT NOT NULL,
    created_by_admin_id INTEGER REFERENCES admins(id) ON DELETE SET NULL,
    created_at INTEGER NOT NULL,
    UNIQUE (content_path, revision_number)
  ) STRICT;

  CREATE TABLE IF NOT EXISTS publish_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    revision_id INTEGER NOT NULL REFERENCES revisions(id) ON DELETE RESTRICT,
    status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
    requested_by_admin_id INTEGER REFERENCES admins(id) ON DELETE SET NULL,
    created_at INTEGER NOT NULL,
    started_at INTEGER,
    finished_at INTEGER,
    error_message TEXT
  ) STRICT;
`;

const versionTwoMigrationSql = `
  CREATE TABLE IF NOT EXISTS admin_setup_tokens (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    token_hash TEXT NOT NULL UNIQUE,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  ) STRICT;

  CREATE TABLE IF NOT EXISTS admin_setup_challenges (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    challenge_hash TEXT NOT NULL UNIQUE,
    username TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    totp_secret_encrypted TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  ) STRICT;
`;

const versionThreeMigrationSql = `
  CREATE TABLE IF NOT EXISTS api_tokens (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    token_prefix TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    scopes_json TEXT NOT NULL CHECK (json_valid(scopes_json)),
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    last_used_at INTEGER,
    revoked_at INTEGER
  ) STRICT;

  CREATE INDEX IF NOT EXISTS api_tokens_active_lookup_idx
    ON api_tokens (token_hash, expires_at, revoked_at);
`;

const versionFourMigrationSql = `
  DELETE FROM sessions;
  DELETE FROM api_tokens;
  DELETE FROM recovery_codes;
  DELETE FROM login_attempts;
  DELETE FROM admin_setup_tokens;
  DELETE FROM admin_setup_challenges;
  UPDATE admins SET password_hash = 'disabled', totp_secret_encrypted = 'disabled';

  ALTER TABLE sessions ADD COLUMN admin_key_id TEXT;

  ALTER TABLE api_tokens RENAME TO legacy_api_tokens;
  DROP INDEX IF EXISTS api_tokens_active_lookup_idx;
  CREATE TABLE api_tokens (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    token_prefix TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    scopes_json TEXT NOT NULL CHECK (json_valid(scopes_json)),
    created_at INTEGER NOT NULL,
    expires_at INTEGER,
    last_used_at INTEGER,
    revoked_at INTEGER
  ) STRICT;
  CREATE INDEX api_tokens_active_lookup_idx
    ON api_tokens (token_hash, expires_at, revoked_at);
  DROP TABLE legacy_api_tokens;

  CREATE TABLE admin_keys (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    key_prefix TEXT NOT NULL,
    key_hash TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL CHECK (role IN ('viewer', 'editor', 'publisher', 'owner', 'custom')),
    permissions_json TEXT NOT NULL CHECK (json_valid(permissions_json)),
    created_at INTEGER NOT NULL,
    expires_at INTEGER,
    last_used_at INTEGER,
    revoked_at INTEGER,
    created_by_key_id TEXT REFERENCES admin_keys(id) ON DELETE SET NULL
  ) STRICT;
  CREATE INDEX admin_keys_active_lookup_idx
    ON admin_keys (key_hash, expires_at, revoked_at);

  ALTER TABLE audit_logs ADD COLUMN admin_key_id TEXT REFERENCES admin_keys(id) ON DELETE SET NULL;
  ALTER TABLE revisions ADD COLUMN created_by_admin_key_id TEXT REFERENCES admin_keys(id) ON DELETE SET NULL;
  ALTER TABLE publish_jobs ADD COLUMN requested_by_admin_key_id TEXT REFERENCES admin_keys(id) ON DELETE SET NULL;
`;
export function migrateAdminDatabase(
  database: DatabaseSync,
  appliedAt = Date.now(),
): void {
  database.exec('PRAGMA foreign_keys = ON');

  const currentVersion = Number(
    database.prepare('PRAGMA user_version').get()?.user_version ?? 0,
  );

  if (currentVersion > migrationVersion) {
    throw new Error(
      `Admin database version ${currentVersion} is newer than supported version ${migrationVersion}.`,
    );
  }

  if (currentVersion === migrationVersion) {
    return;
  }

  database.exec('BEGIN IMMEDIATE');
  try {
    if (currentVersion < 1) {
      database.exec(versionOneMigrationSql);
      database
        .prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)')
        .run(1, appliedAt);
    }

    if (currentVersion < 2) {
      database.exec(versionTwoMigrationSql);
      database
        .prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)')
        .run(2, appliedAt);
    }

    if (currentVersion < 3) {
      database.exec(versionThreeMigrationSql);
      database
        .prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)')
        .run(3, appliedAt);
    }

    if (currentVersion < 4) {
      database.exec(versionFourMigrationSql);
      database
        .prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)')
        .run(4, appliedAt);
    }

    database.exec(`PRAGMA user_version = ${migrationVersion}`);
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}
