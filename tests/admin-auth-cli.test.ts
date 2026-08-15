import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import {
  initializeAdmin,
  resetAdminCredentials,
} from '../admin/cli/admin-credentials';
import { verifyPassword } from '../admin/server/auth/password';
import { hashRecoveryCode } from '../admin/server/auth/recovery-codes';
import { createSession } from '../admin/server/auth/sessions';
import { decryptTotpSecret } from '../admin/server/auth/totp-secret';

const databases: DatabaseSync[] = [];
const encryptionKey = Buffer.alloc(32, 11);

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

describe('administrator CLI core', () => {
  it('initializes the only administrator and returns plaintext setup material once', async () => {
    const database = createDatabase();
    const now = 1_800_000_000_000;

    const setup = await initializeAdmin(database, {
      username: 'owner',
      password: 'initial-password',
    }, {
      encryptionKey,
      now: () => now,
      randomBytes: deterministicRandom(1),
    });
    const admin = database.prepare('SELECT * FROM admins').get();

    expect(setup.adminId).toBe(1);
    expect(setup.username).toBe('owner');
    expect(setup.totpSecret).toMatch(/^[A-Z2-7]{32}$/);
    expect(setup.recoveryCodes).toHaveLength(10);
    expect(decryptTotpSecret(String(admin?.totp_secret_encrypted), encryptionKey))
      .toBe(setup.totpSecret);
    await expect(verifyPassword('initial-password', String(admin?.password_hash)))
      .resolves.toBe(true);
    expect(database.prepare('SELECT COUNT(*) AS count FROM recovery_codes').get())
      .toEqual({ count: 10 });
    expect(database.prepare('SELECT action FROM audit_logs').get())
      .toEqual({ action: 'auth.admin.initialized' });
  });

  it('rejects initialization when the administrator already exists', async () => {
    const database = createDatabase();
    const dependencies = {
      encryptionKey,
      now: () => 1_800_000_000_000,
      randomBytes: deterministicRandom(50),
    };

    await initializeAdmin(database, {
      username: 'owner',
      password: 'initial-password',
    }, dependencies);

    await expect(initializeAdmin(database, {
      username: 'other',
      password: 'another-password',
    }, dependencies)).rejects.toThrow('already initialized');
  });

  it('resets credentials, recovery codes, sessions, and lockout history atomically', async () => {
    const database = createDatabase();
    const now = 1_800_000_000_000;
    const initial = await initializeAdmin(database, {
      username: 'owner',
      password: 'initial-password',
    }, {
      encryptionKey,
      now: () => now,
      randomBytes: deterministicRandom(90),
    });
    createSession(database, initial.adminId, {
      now: () => now,
      randomBytes: deterministicRandom(140),
    });
    database
      .prepare(`
        INSERT INTO login_attempts (username, remote_address, succeeded, attempted_at)
        VALUES ('owner', '192.0.2.30', 0, ?)
      `)
      .run(now);

    const resetAt = now + 60_000;
    const reset = await resetAdminCredentials(database, {
      password: 'replacement-password',
      username: 'renamed-owner',
    }, {
      encryptionKey,
      now: () => resetAt,
      randomBytes: deterministicRandom(180),
    });
    const admin = database.prepare('SELECT * FROM admins').get();

    expect(reset.username).toBe('renamed-owner');
    expect(reset.totpSecret).not.toBe(initial.totpSecret);
    await expect(verifyPassword('replacement-password', String(admin?.password_hash)))
      .resolves.toBe(true);
    await expect(verifyPassword('initial-password', String(admin?.password_hash)))
      .resolves.toBe(false);
    expect(decryptTotpSecret(String(admin?.totp_secret_encrypted), encryptionKey))
      .toBe(reset.totpSecret);
    expect(database.prepare('SELECT revoked_at FROM sessions').get())
      .toEqual({ revoked_at: resetAt });
    expect(database.prepare('SELECT COUNT(*) AS count FROM login_attempts').get())
      .toEqual({ count: 0 });
    expect(database.prepare('SELECT COUNT(*) AS count FROM recovery_codes').get())
      .toEqual({ count: 10 });
    expect(database.prepare('SELECT COUNT(*) AS count FROM recovery_codes WHERE code_hash = ?')
      .get(hashRecoveryCode(initial.recoveryCodes[0])))
      .toEqual({ count: 0 });
    expect(database.prepare('SELECT action FROM audit_logs ORDER BY id DESC LIMIT 1').get())
      .toEqual({ action: 'auth.admin.credentials-reset' });
  });

  it('refuses to reset an uninitialized database', async () => {
    const database = createDatabase();

    await expect(resetAdminCredentials(database, {
      password: 'replacement-password',
    }, {
      encryptionKey,
      now: () => 1_800_000_000_000,
      randomBytes: deterministicRandom(220),
    })).rejects.toThrow('not initialized');
  });
});
