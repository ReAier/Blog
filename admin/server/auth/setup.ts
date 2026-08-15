import { randomBytes as cryptoRandomBytes } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { hashPassword } from './password';
import {
  generateRecoveryCodes,
  hashRecoveryCode,
} from './recovery-codes';
import {
  createSession,
  hashOpaqueToken,
  type CreatedSession,
} from './sessions';
import { decryptTotpSecret, encryptTotpSecret } from './totp-secret';
import { verifyTotp } from './totp';
import { migrateAdminDatabase } from '../db/migrations';

const base32Alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const recoveryCodeCount = 10;

export const SETUP_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
export const SETUP_CHALLENGE_TTL_MS = 15 * 60 * 1000;

export type AdminSetupErrorCode =
  | 'SETUP_ALREADY_COMPLETED'
  | 'INVALID_SETUP_TOKEN'
  | 'INVALID_SETUP_CHALLENGE'
  | 'SETUP_CHALLENGE_EXPIRED'
  | 'INVALID_TOTP'
  | 'INVALID_USERNAME'
  | 'WEAK_PASSWORD';

export class AdminSetupError extends Error {
  readonly code: AdminSetupErrorCode;

  constructor(code: AdminSetupErrorCode, message: string) {
    super(message);
    this.name = 'AdminSetupError';
    this.code = code;
  }
}

interface ClockDependencies {
  now?: () => number;
}

interface SetupDependencies extends ClockDependencies {
  encryptionKey: Buffer;
  randomBytes?: (size: number) => Buffer;
}

interface PrepareOptions {
  replaceAdmin?: boolean;
}

interface BeginSetupInput {
  token: string;
  username: string;
  password: string;
}

interface ConfirmSetupInput {
  challenge: string;
  totpCode: string;
}

interface SetupTokenRow {
  token_hash: string;
  expires_at: number;
}

interface SetupChallengeRow {
  username: string;
  password_hash: string;
  totp_secret_encrypted: string;
  expires_at: number;
}

export interface AdminSetupStatus {
  required: boolean;
  tokenReady: boolean;
}

export interface PreparedAdminSetup {
  token: string;
  expiresAt: number;
}

export interface BegunAdminSetup {
  challenge: string;
  totpSecret: string;
  otpauthUri: string;
  expiresAt: number;
}

export interface ConfirmedAdminSetup {
  username: string;
  recoveryCodes: string[];
  session: CreatedSession;
}

function encodeBase32(value: Buffer): string {
  let bits = 0;
  let bitCount = 0;
  let encoded = '';

  for (const byte of value) {
    bits = (bits << 8) | byte;
    bitCount += 8;
    while (bitCount >= 5) {
      bitCount -= 5;
      encoded += base32Alphabet[(bits >>> bitCount) & 0x1f];
      bits &= (1 << bitCount) - 1;
    }
  }

  if (bitCount > 0) {
    encoded += base32Alphabet[(bits << (5 - bitCount)) & 0x1f];
  }
  return encoded;
}

function requireSetupOpen(database: DatabaseSync): void {
  if (database.prepare('SELECT 1 FROM admins LIMIT 1').get()) {
    throw new AdminSetupError(
      'SETUP_ALREADY_COMPLETED',
      'Administrator setup has already been completed.',
    );
  }
}

function normalizeUsername(username: string): string {
  const normalized = username.trim();
  if (normalized.length === 0 || normalized.length > 64) {
    throw new AdminSetupError(
      'INVALID_USERNAME',
      'Username must contain between 1 and 64 characters.',
    );
  }
  return normalized;
}

function requireStrongPassword(password: string): string {
  if (password.length < 14) {
    throw new AdminSetupError(
      'WEAK_PASSWORD',
      'Password must be at least 14 characters.',
    );
  }
  return password;
}

function createOtpauthUri(username: string, secret: string): string {
  const issuer = 'Aier Blog';
  const label = `${issuer}:${username}`;
  const query = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: '6',
    period: '30',
  });
  return `otpauth://totp/${encodeURIComponent(label)}?${query.toString().replace(/\+/gu, '%20')}`;
}

export function getAdminSetupStatus(
  database: DatabaseSync,
  dependencies: ClockDependencies = {},
): AdminSetupStatus {
  const now = dependencies.now?.() ?? Date.now();
  migrateAdminDatabase(database, now);

  if (database.prepare('SELECT 1 FROM admins LIMIT 1').get()) {
    return { required: false, tokenReady: false };
  }

  const token = database.prepare(`
    SELECT expires_at
    FROM admin_setup_tokens
    WHERE id = 1
  `).get() as { expires_at: number } | undefined;

  return {
    required: true,
    tokenReady: Boolean(token && now < token.expires_at),
  };
}

export function prepareAdminSetup(
  database: DatabaseSync,
  dependencies: SetupDependencies,
  options: PrepareOptions = {},
): PreparedAdminSetup {
  const now = dependencies.now?.() ?? Date.now();
  const randomBytes = dependencies.randomBytes ?? cryptoRandomBytes;
  migrateAdminDatabase(database, now);

  const hasAdmin = Boolean(database.prepare('SELECT 1 FROM admins LIMIT 1').get());
  if (hasAdmin && !options.replaceAdmin) {
    throw new AdminSetupError(
      'SETUP_ALREADY_COMPLETED',
      'Administrator setup has already been completed.',
    );
  }

  const token = randomBytes(32).toString('base64url');
  const expiresAt = now + SETUP_TOKEN_TTL_MS;

  database.exec('BEGIN IMMEDIATE');
  try {
    database.prepare('DELETE FROM admin_setup_challenges').run();
    database.prepare('DELETE FROM admin_setup_tokens').run();

    if (hasAdmin) {
      database.prepare('DELETE FROM admins').run();
      database.prepare('DELETE FROM login_attempts').run();
    }

    database.prepare(`
      INSERT INTO admin_setup_tokens (id, token_hash, created_at, expires_at)
      VALUES (1, ?, ?, ?)
    `).run(hashOpaqueToken(token), now, expiresAt);
    database.prepare(`
      INSERT INTO audit_logs (admin_id, action, details_json, created_at)
      VALUES (NULL, ?, ?, ?)
    `).run(
      'auth.admin.setup-prepared',
      JSON.stringify({ replacedExistingAdmin: hasAdmin }),
      now,
    );
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }

  return { token, expiresAt };
}

export async function beginAdminSetup(
  database: DatabaseSync,
  input: BeginSetupInput,
  dependencies: SetupDependencies,
): Promise<BegunAdminSetup> {
  const now = dependencies.now?.() ?? Date.now();
  const randomBytes = dependencies.randomBytes ?? cryptoRandomBytes;
  migrateAdminDatabase(database, now);
  requireSetupOpen(database);

  const token = database.prepare(`
    SELECT token_hash, expires_at
    FROM admin_setup_tokens
    WHERE id = 1 AND token_hash = ?
  `).get(hashOpaqueToken(input.token)) as unknown as SetupTokenRow | undefined;
  if (!token || now >= token.expires_at) {
    throw new AdminSetupError(
      'INVALID_SETUP_TOKEN',
      'The setup token is invalid or has expired.',
    );
  }

  const username = normalizeUsername(input.username);
  const password = requireStrongPassword(input.password);
  const passwordHash = await hashPassword(password, { randomBytes });
  const totpSecret = encodeBase32(randomBytes(20));
  const encryptedTotpSecret = encryptTotpSecret(
    totpSecret,
    dependencies.encryptionKey,
    { randomBytes },
  );
  const challenge = randomBytes(32).toString('base64url');
  const expiresAt = now + SETUP_CHALLENGE_TTL_MS;

  database.exec('BEGIN IMMEDIATE');
  try {
    requireSetupOpen(database);
    database.prepare('DELETE FROM admin_setup_challenges').run();
    database.prepare(`
      INSERT INTO admin_setup_challenges (
        id,
        challenge_hash,
        username,
        password_hash,
        totp_secret_encrypted,
        created_at,
        expires_at
      ) VALUES (1, ?, ?, ?, ?, ?, ?)
    `).run(
      hashOpaqueToken(challenge),
      username,
      passwordHash,
      encryptedTotpSecret,
      now,
      expiresAt,
    );
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }

  return {
    challenge,
    totpSecret,
    otpauthUri: createOtpauthUri(username, totpSecret),
    expiresAt,
  };
}

export function confirmAdminSetup(
  database: DatabaseSync,
  input: ConfirmSetupInput,
  dependencies: SetupDependencies,
): ConfirmedAdminSetup {
  const now = dependencies.now?.() ?? Date.now();
  const randomBytes = dependencies.randomBytes ?? cryptoRandomBytes;
  migrateAdminDatabase(database, now);
  requireSetupOpen(database);

  const challenge = database.prepare(`
    SELECT username, password_hash, totp_secret_encrypted, expires_at
    FROM admin_setup_challenges
    WHERE id = 1 AND challenge_hash = ?
  `).get(hashOpaqueToken(input.challenge)) as unknown as SetupChallengeRow | undefined;
  if (!challenge) {
    throw new AdminSetupError(
      'INVALID_SETUP_CHALLENGE',
      'The setup challenge is invalid.',
    );
  }
  if (now >= challenge.expires_at) {
    throw new AdminSetupError(
      'SETUP_CHALLENGE_EXPIRED',
      'The setup challenge has expired.',
    );
  }

  const totpSecret = decryptTotpSecret(
    challenge.totp_secret_encrypted,
    dependencies.encryptionKey,
  );
  if (!verifyTotp(input.totpCode, totpSecret, now)) {
    throw new AdminSetupError('INVALID_TOTP', 'The authenticator code is invalid.');
  }

  const recoveryCodes = generateRecoveryCodes(recoveryCodeCount, { randomBytes });
  let session: CreatedSession | undefined;

  database.exec('BEGIN IMMEDIATE');
  try {
    requireSetupOpen(database);
    database.prepare(`
      INSERT INTO admins (
        id,
        username,
        password_hash,
        totp_secret_encrypted,
        created_at,
        updated_at
      ) VALUES (1, ?, ?, ?, ?, ?)
    `).run(
      challenge.username,
      challenge.password_hash,
      challenge.totp_secret_encrypted,
      now,
      now,
    );

    const insertRecoveryCode = database.prepare(`
      INSERT INTO recovery_codes (admin_id, code_hash, created_at)
      VALUES (1, ?, ?)
    `);
    for (const recoveryCode of recoveryCodes) {
      insertRecoveryCode.run(hashRecoveryCode(recoveryCode), now);
    }

    session = createSession(database, 1, { now: () => now, randomBytes });
    database.prepare(`
      INSERT INTO audit_logs (admin_id, action, details_json, created_at)
      VALUES (1, ?, ?, ?)
    `).run(
      'auth.admin.initialized',
      JSON.stringify({ username: challenge.username, source: 'first-run-setup' }),
      now,
    );
    database.prepare('DELETE FROM admin_setup_challenges').run();
    database.prepare('DELETE FROM admin_setup_tokens').run();
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }

  if (!session) {
    throw new Error('Setup session was not created.');
  }

  return {
    username: challenge.username,
    recoveryCodes,
    session,
  };
}
