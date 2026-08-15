import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { initializeAdmin } from '../admin/cli/admin-credentials';
import { generateTotp } from '../admin/server/auth/totp';
import {
  beginAdminSetup,
  confirmAdminSetup,
  getAdminSetupStatus,
  prepareAdminSetup,
  SETUP_CHALLENGE_TTL_MS,
  SETUP_TOKEN_TTL_MS,
} from '../admin/server/auth/setup';
import { migrateAdminDatabase } from '../admin/server/db/migrations';

const databases: DatabaseSync[] = [];
const encryptionKey = Buffer.alloc(32, 19);

function createDatabase(): DatabaseSync {
  const database = new DatabaseSync(':memory:');
  databases.push(database);
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

describe('one-time administrator setup', () => {
  it('prepares a time-limited token while storing only its SHA-256 hash', () => {
    const database = createDatabase();
    const now = 1_800_000_000_000;

    const prepared = prepareAdminSetup(database, {
      encryptionKey,
      now: () => now,
      randomBytes: deterministicRandom(1),
    });
    const row = database.prepare('SELECT * FROM admin_setup_tokens').get();

    expect(prepared.token).toMatch(/^[A-Za-z0-9_-]{40,}$/u);
    expect(prepared.expiresAt).toBe(now + SETUP_TOKEN_TTL_MS);
    expect(row?.token_hash).not.toBe(prepared.token);
    expect(String(row?.token_hash)).not.toContain(prepared.token);
    expect(getAdminSetupStatus(database, { now: () => now })).toEqual({
      required: true,
      tokenReady: true,
    });
    expect(getAdminSetupStatus(database, {
      now: () => now + SETUP_TOKEN_TTL_MS + 1,
    })).toEqual({
      required: true,
      tokenReady: false,
    });
  });

  it('begins setup only with the server-issued token and stores encrypted TOTP material', async () => {
    const database = createDatabase();
    const now = 1_800_000_000_000;
    const randomBytes = deterministicRandom(20);
    const prepared = prepareAdminSetup(database, {
      encryptionKey,
      now: () => now,
      randomBytes,
    });

    await expect(beginAdminSetup(database, {
      token: 'incorrect-token',
      username: 'owner',
      password: 'correct horse battery staple',
    }, {
      encryptionKey,
      now: () => now,
      randomBytes,
    })).rejects.toMatchObject({ code: 'INVALID_SETUP_TOKEN' });

    const challenge = await beginAdminSetup(database, {
      token: prepared.token,
      username: 'owner',
      password: 'correct horse battery staple',
    }, {
      encryptionKey,
      now: () => now,
      randomBytes,
    });
    const row = database.prepare('SELECT * FROM admin_setup_challenges').get();

    expect(challenge.challenge).toMatch(/^[A-Za-z0-9_-]{40,}$/u);
    expect(challenge.expiresAt).toBe(now + SETUP_CHALLENGE_TTL_MS);
    expect(challenge.totpSecret).toMatch(/^[A-Z2-7]{32}$/u);
    expect(challenge.otpauthUri).toContain('otpauth://totp/');
    expect(challenge.otpauthUri).toContain('issuer=Aier%20Blog');
    expect(row?.challenge_hash).not.toBe(challenge.challenge);
    expect(row?.totp_secret_encrypted).not.toBe(challenge.totpSecret);
    expect(String(row?.totp_secret_encrypted)).not.toContain(challenge.totpSecret);
    expect(database.prepare('SELECT COUNT(*) AS count FROM admins').get())
      .toEqual({ count: 0 });
  });

  it('confirms TOTP, creates the only admin and session, and permanently closes setup', async () => {
    const database = createDatabase();
    const now = 1_800_000_000_000;
    const randomBytes = deterministicRandom(80);
    const prepared = prepareAdminSetup(database, {
      encryptionKey,
      now: () => now,
      randomBytes,
    });
    const challenge = await beginAdminSetup(database, {
      token: prepared.token,
      username: 'owner',
      password: 'correct horse battery staple',
    }, {
      encryptionKey,
      now: () => now,
      randomBytes,
    });

    expect(() => confirmAdminSetup(database, {
      challenge: challenge.challenge,
      totpCode: '000000',
    }, {
      encryptionKey,
      now: () => now,
      randomBytes,
    })).toThrow(expect.objectContaining({ code: 'INVALID_TOTP' }));

    const confirmed = confirmAdminSetup(database, {
      challenge: challenge.challenge,
      totpCode: generateTotp(challenge.totpSecret, now),
    }, {
      encryptionKey,
      now: () => now,
      randomBytes,
    });

    expect(confirmed.username).toBe('owner');
    expect(confirmed.recoveryCodes).toHaveLength(10);
    expect(confirmed.session.token).toMatch(/^[A-Za-z0-9_-]{40,}$/u);
    expect(confirmed.session.csrfToken).toMatch(/^[A-Za-z0-9_-]{40,}$/u);
    expect(database.prepare('SELECT COUNT(*) AS count FROM admins').get())
      .toEqual({ count: 1 });
    expect(database.prepare('SELECT COUNT(*) AS count FROM recovery_codes').get())
      .toEqual({ count: 10 });
    expect(database.prepare('SELECT COUNT(*) AS count FROM sessions').get())
      .toEqual({ count: 1 });
    expect(database.prepare('SELECT COUNT(*) AS count FROM admin_setup_tokens').get())
      .toEqual({ count: 0 });
    expect(database.prepare('SELECT COUNT(*) AS count FROM admin_setup_challenges').get())
      .toEqual({ count: 0 });
    expect(getAdminSetupStatus(database, { now: () => now })).toEqual({
      required: false,
      tokenReady: false,
    });

    expect(() => prepareAdminSetup(database, {
      encryptionKey,
      now: () => now,
      randomBytes,
    })).toThrow(expect.objectContaining({ code: 'SETUP_ALREADY_COMPLETED' }));
  });

  it('rejects an expired setup challenge', async () => {
    const database = createDatabase();
    const now = 1_800_000_000_000;
    const randomBytes = deterministicRandom(140);
    const prepared = prepareAdminSetup(database, {
      encryptionKey,
      now: () => now,
      randomBytes,
    });
    const challenge = await beginAdminSetup(database, {
      token: prepared.token,
      username: 'owner',
      password: 'correct horse battery staple',
    }, {
      encryptionKey,
      now: () => now,
      randomBytes,
    });

    expect(() => confirmAdminSetup(database, {
      challenge: challenge.challenge,
      totpCode: generateTotp(
        challenge.totpSecret,
        now + SETUP_CHALLENGE_TTL_MS + 1,
      ),
    }, {
      encryptionKey,
      now: () => now + SETUP_CHALLENGE_TTL_MS + 1,
      randomBytes,
    })).toThrow(expect.objectContaining({ code: 'SETUP_CHALLENGE_EXPIRED' }));
  });

  it('requires an explicit replacement flag and preserves non-authentication state', async () => {
    const database = createDatabase();
    const now = 1_800_000_000_000;
    migrateAdminDatabase(database, now);
    await initializeAdmin(database, {
      username: 'old-owner',
      password: 'old-owner-password',
    }, {
      encryptionKey,
      now: () => now,
      randomBytes: deterministicRandom(180),
    });
    database.prepare(`
      INSERT INTO revisions (
        content_path,
        revision_number,
        content_sha256,
        content,
        created_by_admin_id,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run('blog/example.md', 1, 'abc', '# Example', 1, now);
    const auditCountBefore = Number(
      database.prepare('SELECT COUNT(*) AS count FROM audit_logs').get()?.count,
    );

    expect(() => prepareAdminSetup(database, {
      encryptionKey,
      now: () => now,
      randomBytes: deterministicRandom(220),
    })).toThrow(expect.objectContaining({ code: 'SETUP_ALREADY_COMPLETED' }));

    const prepared = prepareAdminSetup(database, {
      encryptionKey,
      now: () => now,
      randomBytes: deterministicRandom(220),
    }, { replaceAdmin: true });

    expect(prepared.token).toBeTruthy();
    expect(database.prepare('SELECT COUNT(*) AS count FROM admins').get())
      .toEqual({ count: 0 });
    expect(database.prepare('SELECT COUNT(*) AS count FROM sessions').get())
      .toEqual({ count: 0 });
    expect(database.prepare('SELECT COUNT(*) AS count FROM recovery_codes').get())
      .toEqual({ count: 0 });
    expect(database.prepare('SELECT COUNT(*) AS count FROM revisions').get())
      .toEqual({ count: 1 });
    expect(database.prepare('SELECT created_by_admin_id FROM revisions').get())
      .toEqual({ created_by_admin_id: null });
    expect(database.prepare('SELECT COUNT(*) AS count FROM audit_logs').get())
      .toEqual({ count: auditCountBefore + 1 });
  });
});
