import type { DatabaseSync } from 'node:sqlite';
import type {
  LoginRequest,
  LoginResult,
  SecondFactorInput,
} from '../../shared/auth-types';
import { verifyPassword as verifyStoredPassword } from './password';
import { hashRecoveryCode } from './recovery-codes';
import { createSession } from './sessions';
import { decryptTotpSecret } from './totp-secret';
import { verifyTotp } from './totp';

export const MAX_FAILED_LOGIN_ATTEMPTS = 10;
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

interface LoginDependencies {
  encryptionKey: Buffer;
  now?: () => number;
  randomBytes?: (size: number) => Buffer;
  verifyPassword?: (password: string, encodedHash: string) => Promise<boolean>;
}

interface AdminRow {
  id: number;
  password_hash: string;
  totp_secret_encrypted: string;
}

interface AttemptRow {
  succeeded: number;
  attempted_at: number;
}

const dummyPasswordHash = '$argon2id$v=19$m=65536,t=3,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

function getFailureStreakRetryAfterMs(
  database: DatabaseSync,
  field: 'username' | 'remote_address',
  value: string,
  now: number,
): number | null {
  const attempts = database
    .prepare(`
      SELECT succeeded, attempted_at
      FROM login_attempts
      WHERE ${field} = ? AND attempted_at > ?
      ORDER BY attempted_at DESC, id DESC
    `)
    .all(value, now - LOCKOUT_DURATION_MS) as unknown as AttemptRow[];

  let consecutiveFailures = 0;
  let newestFailureAt: number | null = null;
  for (const attempt of attempts) {
    if (attempt.succeeded === 1) {
      break;
    }
    newestFailureAt ??= attempt.attempted_at;
    consecutiveFailures += 1;
  }

  if (
    consecutiveFailures < MAX_FAILED_LOGIN_ATTEMPTS
    || newestFailureAt === null
  ) {
    return null;
  }

  const lockedUntil = newestFailureAt + LOCKOUT_DURATION_MS;
  return lockedUntil > now ? lockedUntil - now : null;
}

function getLockRetryAfterMs(
  database: DatabaseSync,
  username: string,
  remoteAddress: string,
  now: number,
): number | null {
  const retryAfterValues = [
    getFailureStreakRetryAfterMs(database, 'username', username, now),
    getFailureStreakRetryAfterMs(database, 'remote_address', remoteAddress, now),
  ].filter((value): value is number => value !== null);

  return retryAfterValues.length > 0 ? Math.max(...retryAfterValues) : null;
}

function recordAttempt(
  database: DatabaseSync,
  request: LoginRequest,
  succeeded: boolean,
  now: number,
): void {
  database
    .prepare(`
      INSERT INTO login_attempts (username, remote_address, succeeded, attempted_at)
      VALUES (?, ?, ?, ?)
    `)
    .run(request.username, request.remoteAddress, succeeded ? 1 : 0, now);
}

function recordAudit(
  database: DatabaseSync,
  adminId: number | null,
  action: string,
  request: LoginRequest,
  now: number,
  details: Record<string, unknown>,
): void {
  database
    .prepare(`
      INSERT INTO audit_logs (admin_id, action, details_json, remote_address, created_at)
      VALUES (?, ?, ?, ?, ?)
    `)
    .run(
      adminId,
      action,
      JSON.stringify(details),
      request.remoteAddress,
      now,
    );
}

function findUnusedRecoveryCodeId(
  database: DatabaseSync,
  adminId: number,
  code: string,
): number | null {
  const row = database
    .prepare(`
      SELECT id
      FROM recovery_codes
      WHERE admin_id = ? AND code_hash = ? AND used_at IS NULL
    `)
    .get(adminId, hashRecoveryCode(code)) as { id: number } | undefined;
  return row?.id ?? null;
}

function validateSecondFactor(
  database: DatabaseSync,
  admin: AdminRow,
  secondFactor: SecondFactorInput,
  encryptionKey: Buffer,
  now: number,
): { valid: boolean; recoveryCodeId: number | null } {
  if (secondFactor.type === 'totp') {
    try {
      const secret = decryptTotpSecret(admin.totp_secret_encrypted, encryptionKey);
      return {
        valid: verifyTotp(secondFactor.code, secret, now),
        recoveryCodeId: null,
      };
    } catch {
      return { valid: false, recoveryCodeId: null };
    }
  }

  const recoveryCodeId = findUnusedRecoveryCodeId(
    database,
    admin.id,
    secondFactor.code,
  );
  return {
    valid: recoveryCodeId !== null,
    recoveryCodeId,
  };
}

function failLogin(
  database: DatabaseSync,
  request: LoginRequest,
  adminId: number | null,
  now: number,
): LoginResult {
  database.exec('BEGIN IMMEDIATE');
  try {
    recordAttempt(database, request, false, now);
    recordAudit(database, adminId, 'auth.login.failed', request, now, {
      secondFactor: request.secondFactor.type,
    });
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }

  const retryAfterMs = getLockRetryAfterMs(
    database,
    request.username,
    request.remoteAddress,
    now,
  );
  if (retryAfterMs !== null) {
    return { ok: false, reason: 'locked', retryAfterMs };
  }
  return { ok: false, reason: 'invalid-credentials' };
}

export async function authenticateAdmin(
  database: DatabaseSync,
  request: LoginRequest,
  dependencies: LoginDependencies,
): Promise<LoginResult> {
  const now = dependencies.now?.() ?? Date.now();
  const retryAfterMs = getLockRetryAfterMs(
    database,
    request.username,
    request.remoteAddress,
    now,
  );
  if (retryAfterMs !== null) {
    return { ok: false, reason: 'locked', retryAfterMs };
  }

  const admin = database
    .prepare(`
      SELECT id, password_hash, totp_secret_encrypted
      FROM admins
      WHERE username = ?
    `)
    .get(request.username) as unknown as AdminRow | undefined;
  const verifyPassword = dependencies.verifyPassword ?? verifyStoredPassword;
  const passwordValid = await verifyPassword(
    request.password,
    admin?.password_hash ?? dummyPasswordHash,
  );
  if (!admin || !passwordValid) {
    return failLogin(database, request, admin?.id ?? null, now);
  }

  const secondFactor = validateSecondFactor(
    database,
    admin,
    request.secondFactor,
    dependencies.encryptionKey,
    now,
  );
  if (!secondFactor.valid) {
    return failLogin(database, request, admin.id, now);
  }

  database.exec('BEGIN IMMEDIATE');
  try {
    if (secondFactor.recoveryCodeId !== null) {
      const consumption = database
        .prepare(`
          UPDATE recovery_codes
          SET used_at = ?
          WHERE id = ? AND used_at IS NULL
        `)
        .run(now, secondFactor.recoveryCodeId);
      if (consumption.changes !== 1) {
        database.exec('ROLLBACK');
        return failLogin(database, request, admin.id, now);
      }
    }

    const session = createSession(database, admin.id, {
      now: () => now,
      randomBytes: dependencies.randomBytes,
    });
    recordAttempt(database, request, true, now);
    recordAudit(database, admin.id, 'auth.login.succeeded', request, now, {
      secondFactor: request.secondFactor.type,
      sessionId: session.id,
    });
    database.exec('COMMIT');

    return {
      ok: true,
      secondFactor: request.secondFactor.type,
      session,
    };
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}
