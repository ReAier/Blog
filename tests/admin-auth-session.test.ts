import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { migrateAdminDatabase } from '../admin/server/db/migrations';
import {
  ABSOLUTE_SESSION_TTL_MS,
  IDLE_SESSION_TTL_MS,
  createSession,
  deriveSessionCsrfToken,
  hashOpaqueToken,
  synchronizeSessionCsrfToken,
  validateSession,
} from '../admin/server/auth/sessions';
import { verifyCsrfRequest } from '../admin/server/auth/csrf';

const databases: DatabaseSync[] = [];

function createDatabase(): DatabaseSync {
  const database = new DatabaseSync(':memory:');
  databases.push(database);
  migrateAdminDatabase(database);
  database
    .prepare(`
      INSERT INTO admins (id, username, password_hash, totp_secret_encrypted, created_at, updated_at)
      VALUES (1, 'owner', 'hash', 'secret', 1, 1)
    `)
    .run();
  return database;
}

function deterministicRandom(seed = 0): (size: number) => Buffer {
  let cursor = seed;
  return (size) => Buffer.from(
    Array.from({ length: size }, () => {
      const value = cursor % 256;
      cursor += 1;
      return value;
    }),
  );
}

afterEach(() => {
  while (databases.length > 0) {
    databases.pop()?.close();
  }
});

describe('admin sessions', () => {
  it('derives one stable CSRF token per browser session token', () => {
    const sessionToken = 'session-token-a';

    expect(deriveSessionCsrfToken(sessionToken)).toBe(deriveSessionCsrfToken(sessionToken));
    expect(deriveSessionCsrfToken(sessionToken)).not.toBe(deriveSessionCsrfToken('session-token-b'));
    expect(deriveSessionCsrfToken(sessionToken)).toMatch(/^[A-Za-z0-9_-]{40,}$/);
  });

  it('upgrades an existing session to the deterministic CSRF token', () => {
    const database = createDatabase();
    const session = createSession(database, 1, { randomBytes: deterministicRandom(20) });
    database.prepare('UPDATE sessions SET csrf_token_hash = ? WHERE id = ?')
      .run(hashOpaqueToken('legacy-token'), session.id);

    const csrfToken = synchronizeSessionCsrfToken(database, session.id, session.token);

    expect(csrfToken).toBe(deriveSessionCsrfToken(session.token));
    expect(database.prepare('SELECT csrf_token_hash FROM sessions WHERE id = ?').get(session.id))
      .toEqual({ csrf_token_hash: hashOpaqueToken(csrfToken) });
  });

  it('stores only hashes of random session and CSRF tokens', () => {
    const database = createDatabase();
    const now = 1_800_000_000_000;

    const session = createSession(database, 1, {
      now: () => now,
      randomBytes: deterministicRandom(10),
    });
    const row = database.prepare('SELECT * FROM sessions').get();

    expect(session.token).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(session.csrfToken).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(row?.token_hash).toBe(hashOpaqueToken(session.token));
    expect(row?.csrf_token_hash).toBe(hashOpaqueToken(session.csrfToken));
    expect(JSON.stringify(row)).not.toContain(session.token);
    expect(JSON.stringify(row)).not.toContain(session.csrfToken);
    expect(session.idleExpiresAt).toBe(now + IDLE_SESSION_TTL_MS);
    expect(session.absoluteExpiresAt).toBe(now + ABSOLUTE_SESSION_TTL_MS);
  });

  it('slides the idle expiry but never extends the seven-day absolute expiry', () => {
    const database = createDatabase();
    const createdAt = 1_800_000_000_000;
    let now = createdAt;
    const dependencies = {
      now: () => now,
      randomBytes: deterministicRandom(50),
    };
    const created = createSession(database, 1, dependencies);

    now += 11 * 60 * 60 * 1000;
    const active = validateSession(database, created.token, dependencies);
    expect(active?.idleExpiresAt).toBe(now + IDLE_SESSION_TTL_MS);

    now = created.absoluteExpiresAt;
    expect(validateSession(database, created.token, dependencies)).toBeNull();
    expect(database.prepare('SELECT revoked_at FROM sessions').get()?.revoked_at).toBe(now);
  });

  it('expires an untouched session after twelve idle hours', () => {
    const database = createDatabase();
    const createdAt = 1_800_000_000_000;
    let now = createdAt;
    const dependencies = {
      now: () => now,
      randomBytes: deterministicRandom(90),
    };
    const created = createSession(database, 1, dependencies);

    now += IDLE_SESSION_TTL_MS;
    expect(validateSession(database, created.token, dependencies)).toBeNull();
  });
});

describe('CSRF and Origin checks', () => {
  it('requires both a valid CSRF token and an allowed Origin for unsafe methods', () => {
    const csrfToken = 'csrf-token';
    const csrfTokenHash = hashOpaqueToken(csrfToken);
    const baseRequest = {
      method: 'POST',
      origin: 'https://admin.example.com',
      allowedOrigins: ['https://admin.example.com'],
      csrfToken,
      csrfTokenHash,
    };

    expect(verifyCsrfRequest(baseRequest)).toBe(true);
    expect(verifyCsrfRequest({
      ...baseRequest,
      origin: 'https://attacker.example.com',
    })).toBe(false);
    expect(verifyCsrfRequest({
      ...baseRequest,
      csrfToken: 'wrong-token',
    })).toBe(false);
    expect(verifyCsrfRequest({
      ...baseRequest,
      origin: undefined,
    })).toBe(false);
  });

  it('does not require CSRF credentials for safe methods', () => {
    expect(verifyCsrfRequest({
      method: 'GET',
      origin: undefined,
      allowedOrigins: ['https://admin.example.com'],
      csrfToken: undefined,
      csrfTokenHash: undefined,
    })).toBe(true);
  });
});
