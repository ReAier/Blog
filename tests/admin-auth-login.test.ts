import { DatabaseSync } from 'node:sqlite';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { LoginResult } from '../admin/shared/auth-types';
import {
  LOCKOUT_DURATION_MS,
  MAX_FAILED_LOGIN_ATTEMPTS,
  authenticateAdmin,
} from '../admin/server/auth/login';
import { encryptTotpSecret } from '../admin/server/auth/totp-secret';
import { generateTotp } from '../admin/server/auth/totp';
import { hashRecoveryCode } from '../admin/server/auth/recovery-codes';
import { hashPassword } from '../admin/server/auth/password';
import { migrateAdminDatabase } from '../admin/server/db/migrations';

const databases: DatabaseSync[] = [];
const encryptionKey = Buffer.alloc(32, 9);
const totpSecret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
let passwordHash = '';

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

function createDatabase(now: number): DatabaseSync {
  const database = new DatabaseSync(':memory:');
  databases.push(database);
  migrateAdminDatabase(database, now);
  database
    .prepare(`
      INSERT INTO admins (id, username, password_hash, totp_secret_encrypted, created_at, updated_at)
      VALUES (1, 'owner', ?, ?, ?, ?)
    `)
    .run(
      passwordHash,
      encryptTotpSecret(totpSecret, encryptionKey, {
        randomBytes: deterministicRandom(1),
      }),
      now,
      now,
    );
  database
    .prepare(`
      INSERT INTO recovery_codes (admin_id, code_hash, created_at)
      VALUES (1, ?, ?), (1, ?, ?)
    `)
    .run(
      hashRecoveryCode('ABCDE-FGHJK-LMNPQ-RSTUV'),
      now,
      hashRecoveryCode('23456-789AB-CDEFG-HJKLM'),
      now,
    );
  return database;
}

beforeAll(async () => {
  passwordHash = await hashPassword('strong-password', {
    randomBytes: deterministicRandom(120),
  });
});

afterEach(() => {
  while (databases.length > 0) {
    databases.pop()?.close();
  }
});

afterAll(() => {
  passwordHash = '';
});

describe('administrator login', () => {
  it('accepts password plus TOTP, creates a session, and records state', async () => {
    const now = 1_800_000_000_000;
    const database = createDatabase(now);
    const result = await authenticateAdmin(database, {
      username: 'owner',
      password: 'strong-password',
      secondFactor: { type: 'totp', code: generateTotp(totpSecret, now) },
      remoteAddress: '192.0.2.10',
    }, {
      encryptionKey,
      now: () => now,
      randomBytes: deterministicRandom(50),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.secondFactor).toBe('totp');
    expect(result.session.token).toBeTruthy();
    expect(database.prepare('SELECT token_hash FROM sessions').get()?.token_hash)
      .not.toBe(result.session.token);
    expect(database.prepare('SELECT succeeded FROM login_attempts').get())
      .toEqual({ succeeded: 1 });
    expect(database.prepare('SELECT action FROM audit_logs').get())
      .toEqual({ action: 'auth.login.succeeded' });
  });

  it('accepts a recovery code exactly once', async () => {
    const now = 1_800_000_000_000;
    const database = createDatabase(now);
    const request = {
      username: 'owner',
      password: 'strong-password',
      secondFactor: {
        type: 'recovery-code' as const,
        code: 'abcde-fghjk-lmnpq-rstuv',
      },
      remoteAddress: '192.0.2.11',
    };
    const dependencies = {
      encryptionKey,
      now: () => now,
      randomBytes: deterministicRandom(80),
    };

    const first = await authenticateAdmin(database, request, dependencies);
    const second = await authenticateAdmin(database, request, dependencies);

    expect(first).toMatchObject({ ok: true, secondFactor: 'recovery-code' });
    expect(second).toEqual({ ok: false, reason: 'invalid-credentials' });
    expect(database.prepare('SELECT used_at FROM recovery_codes WHERE id = 1').get())
      .toEqual({ used_at: now });
  });

  it('records invalid TOTP attempts without creating sessions', async () => {
    const now = 1_800_000_000_000;
    const database = createDatabase(now);

    const result = await authenticateAdmin(database, {
      username: 'owner',
      password: 'strong-password',
      secondFactor: { type: 'totp', code: '000000' },
      remoteAddress: '192.0.2.12',
    }, {
      encryptionKey,
      now: () => now,
      randomBytes: deterministicRandom(100),
    });

    expect(result).toEqual({ ok: false, reason: 'invalid-credentials' });
    expect(database.prepare('SELECT COUNT(*) AS count FROM sessions').get())
      .toEqual({ count: 0 });
    expect(database.prepare('SELECT succeeded FROM login_attempts').get())
      .toEqual({ succeeded: 0 });
  });
});

describe('login lockout', () => {
  it('tracks username and remote-address failure streaks independently', async () => {
    const now = 1_800_000_000_000;
    const database = createDatabase(now);
    let passwordValid = false;
    const dependencies = {
      encryptionKey,
      now: () => now,
      randomBytes: deterministicRandom(130),
      verifyPassword: async () => passwordValid,
    };
    const failedFromOriginalAddress = {
      username: 'owner',
      password: 'wrong',
      secondFactor: { type: 'totp' as const, code: '000000' },
      remoteAddress: '192.0.2.19',
    };

    for (let attempt = 0; attempt < MAX_FAILED_LOGIN_ATTEMPTS - 1; attempt += 1) {
      await authenticateAdmin(database, failedFromOriginalAddress, dependencies);
    }

    passwordValid = true;
    const successElsewhere = await authenticateAdmin(database, {
      username: 'owner',
      password: 'strong-password',
      secondFactor: { type: 'totp', code: generateTotp(totpSecret, now) },
      remoteAddress: '192.0.2.99',
    }, dependencies);
    expect(successElsewhere.ok).toBe(true);

    passwordValid = false;
    expect(await authenticateAdmin(
      database,
      failedFromOriginalAddress,
      dependencies,
    )).toEqual({
      ok: false,
      reason: 'locked',
      retryAfterMs: LOCKOUT_DURATION_MS,
    });
  });
  it('locks after five consecutive failures for the username or remote address', async () => {
    let now = 1_800_000_000_000;
    const database = createDatabase(now);
    let passwordChecks = 0;
    const dependencies = {
      encryptionKey,
      now: () => now,
      randomBytes: deterministicRandom(140),
      verifyPassword: async () => {
        passwordChecks += 1;
        return false;
      },
    };
    const request = {
      username: 'owner',
      password: 'wrong',
      secondFactor: { type: 'totp' as const, code: '000000' },
      remoteAddress: '192.0.2.20',
    };

    let result: LoginResult = { ok: false, reason: 'invalid-credentials' };
    for (let attempt = 1; attempt <= MAX_FAILED_LOGIN_ATTEMPTS; attempt += 1) {
      result = await authenticateAdmin(database, request, dependencies);
    }

    expect(result).toEqual({
      ok: false,
      reason: 'locked',
      retryAfterMs: LOCKOUT_DURATION_MS,
    });
    expect(passwordChecks).toBe(MAX_FAILED_LOGIN_ATTEMPTS);

    const blocked = await authenticateAdmin(database, {
      ...request,
      username: 'someone-else',
    }, dependencies);
    expect(blocked).toEqual({
      ok: false,
      reason: 'locked',
      retryAfterMs: LOCKOUT_DURATION_MS,
    });
    expect(passwordChecks).toBe(MAX_FAILED_LOGIN_ATTEMPTS);

    now += LOCKOUT_DURATION_MS;
    expect(await authenticateAdmin(database, request, dependencies)).toEqual({
      ok: false,
      reason: 'invalid-credentials',
    });
    expect(passwordChecks).toBe(MAX_FAILED_LOGIN_ATTEMPTS + 1);
  });
});
