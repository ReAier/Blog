import {
  createHash,
  createHmac,
  randomBytes as cryptoRandomBytes,
} from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';

export const IDLE_SESSION_TTL_MS = 12 * 60 * 60 * 1000;
export const ABSOLUTE_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface SessionDependencies {
  now?: () => number;
  randomBytes?: (size: number) => Buffer;
}

export interface CreatedSession {
  id: number;
  adminId: number;
  adminKeyId?: string;
  token: string;
  csrfToken: string;
  createdAt: number;
  idleExpiresAt: number;
  absoluteExpiresAt: number;
}

export interface ValidatedSession {
  id: number;
  adminId: number;
  adminKeyId?: string;
  csrfTokenHash: string;
  createdAt: number;
  lastSeenAt: number;
  idleExpiresAt: number;
  absoluteExpiresAt: number;
}

interface SessionRow {
  id: number;
  admin_id: number;
  admin_key_id: string | null;
  csrf_token_hash: string;
  created_at: number;
  last_seen_at: number;
  idle_expires_at: number;
  absolute_expires_at: number;
  revoked_at: number | null;
}

export function hashOpaqueToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('base64url');
}

export function deriveSessionCsrfToken(sessionToken: string): string {
  return createHmac('sha256', sessionToken)
    .update('aier-admin-csrf-v1', 'utf8')
    .digest('base64url');
}

export function createSession(
  database: DatabaseSync,
  adminId: number,
  dependencies: SessionDependencies = {},
): CreatedSession {
  const now = dependencies.now?.() ?? Date.now();
  const randomBytes = dependencies.randomBytes ?? cryptoRandomBytes;
  const token = randomBytes(32).toString('base64url');
  const csrfToken = deriveSessionCsrfToken(token);
  const idleExpiresAt = now + IDLE_SESSION_TTL_MS;
  const absoluteExpiresAt = now + ABSOLUTE_SESSION_TTL_MS;
  const result = database
    .prepare(`
      INSERT INTO sessions (
        admin_id,
        token_hash,
        csrf_token_hash,
        created_at,
        last_seen_at,
        idle_expires_at,
        absolute_expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      adminId,
      hashOpaqueToken(token),
      hashOpaqueToken(csrfToken),
      now,
      now,
      idleExpiresAt,
      absoluteExpiresAt,
    );

  return {
    id: Number(result.lastInsertRowid),
    adminId,
    token,
    csrfToken,
    createdAt: now,
    idleExpiresAt,
    absoluteExpiresAt,
  };
}

export function createAdminKeySession(
  database: DatabaseSync,
  adminKeyId: string,
  dependencies: SessionDependencies = {},
): CreatedSession {
  const now = dependencies.now?.() ?? Date.now();
  const randomBytes = dependencies.randomBytes ?? cryptoRandomBytes;
  const token = randomBytes(32).toString('base64url');
  const csrfToken = deriveSessionCsrfToken(token);
  const idleExpiresAt = now + IDLE_SESSION_TTL_MS;
  const absoluteExpiresAt = now + ABSOLUTE_SESSION_TTL_MS;
  database.prepare("INSERT OR IGNORE INTO admins (id, username, password_hash, totp_secret_encrypted, created_at, updated_at) VALUES (1, 'legacy-admin', 'disabled', 'disabled', 0, 0)").run();
  const result = database.prepare(`
    INSERT INTO sessions (
      admin_id, admin_key_id, token_hash, csrf_token_hash, created_at,
      last_seen_at, idle_expires_at, absolute_expires_at
    ) VALUES (1, ?, ?, ?, ?, ?, ?, ?)
  `).run(adminKeyId, hashOpaqueToken(token), hashOpaqueToken(csrfToken), now, now, idleExpiresAt, absoluteExpiresAt);
  return {
    id: Number(result.lastInsertRowid),
    adminId: 1,
    adminKeyId,
    token,
    csrfToken,
    createdAt: now,
    idleExpiresAt,
    absoluteExpiresAt,
  };
}
export function validateSession(
  database: DatabaseSync,
  token: string,
  dependencies: SessionDependencies = {},
): ValidatedSession | null {
  const now = dependencies.now?.() ?? Date.now();
  const row = database
    .prepare(`
      SELECT
        id,
        admin_id,
        admin_key_id,
        csrf_token_hash,
        created_at,
        last_seen_at,
        idle_expires_at,
        absolute_expires_at,
        revoked_at
      FROM sessions
      WHERE token_hash = ?
    `)
    .get(hashOpaqueToken(token)) as unknown as SessionRow | undefined;

  if (!row || row.revoked_at !== null) {
    return null;
  }

  if (now >= row.idle_expires_at || now >= row.absolute_expires_at) {
    database
      .prepare('UPDATE sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL')
      .run(now, row.id);
    return null;
  }

  const idleExpiresAt = Math.min(
    now + IDLE_SESSION_TTL_MS,
    row.absolute_expires_at,
  );
  database
    .prepare(`
      UPDATE sessions
      SET last_seen_at = ?, idle_expires_at = ?
      WHERE id = ? AND revoked_at IS NULL
    `)
    .run(now, idleExpiresAt, row.id);

  return {
    id: row.id,
    adminId: row.admin_id,
    adminKeyId: row.admin_key_id ?? undefined,
    csrfTokenHash: row.csrf_token_hash,
    createdAt: row.created_at,
    lastSeenAt: now,
    idleExpiresAt,
    absoluteExpiresAt: row.absolute_expires_at,
  };
}

export function synchronizeSessionCsrfToken(
  database: DatabaseSync,
  sessionId: number,
  sessionToken: string,
): string {
  const csrfToken = deriveSessionCsrfToken(sessionToken);
  const result = database.prepare(
    'UPDATE sessions SET csrf_token_hash = ? WHERE id = ? AND revoked_at IS NULL',
  ).run(hashOpaqueToken(csrfToken), sessionId);
  if (result.changes !== 1) throw new Error('Cannot update CSRF token for an inactive session.');
  return csrfToken;
}
