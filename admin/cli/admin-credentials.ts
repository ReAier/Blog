import { randomBytes as cryptoRandomBytes } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { hashPassword } from '../server/auth/password';
import {
  generateRecoveryCodes,
  hashRecoveryCode,
} from '../server/auth/recovery-codes';
import { encryptTotpSecret } from '../server/auth/totp-secret';
import { migrateAdminDatabase } from '../server/db/migrations';

const base32Alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const defaultRecoveryCodeCount = 10;

interface CredentialDependencies {
  encryptionKey: Buffer;
  now?: () => number;
  randomBytes?: (size: number) => Buffer;
}

interface InitializeAdminInput {
  username: string;
  password: string;
}

interface ResetAdminInput {
  username?: string;
  password: string;
}

export interface AdminSetupMaterial {
  adminId: number;
  username: string;
  totpSecret: string;
  recoveryCodes: string[];
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

function createSetupMaterial(
  dependencies: CredentialDependencies,
): {
  totpSecret: string;
  encryptedTotpSecret: string;
  recoveryCodes: string[];
} {
  const randomBytes = dependencies.randomBytes ?? cryptoRandomBytes;
  const totpSecret = encodeBase32(randomBytes(20));
  return {
    totpSecret,
    encryptedTotpSecret: encryptTotpSecret(
      totpSecret,
      dependencies.encryptionKey,
      { randomBytes },
    ),
    recoveryCodes: generateRecoveryCodes(defaultRecoveryCodeCount, {
      randomBytes,
    }),
  };
}

function insertRecoveryCodes(
  database: DatabaseSync,
  adminId: number,
  recoveryCodes: readonly string[],
  now: number,
): void {
  const insert = database.prepare(`
    INSERT INTO recovery_codes (admin_id, code_hash, created_at)
    VALUES (?, ?, ?)
  `);
  for (const recoveryCode of recoveryCodes) {
    insert.run(adminId, hashRecoveryCode(recoveryCode), now);
  }
}

function recordAudit(
  database: DatabaseSync,
  adminId: number,
  action: string,
  now: number,
  username: string,
): void {
  database
    .prepare(`
      INSERT INTO audit_logs (admin_id, action, details_json, created_at)
      VALUES (?, ?, ?, ?)
    `)
    .run(adminId, action, JSON.stringify({ username }), now);
}

function requireNonEmpty(value: string, label: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new Error(`${label} must not be empty.`);
  }
  return normalized;
}

export async function initializeAdmin(
  database: DatabaseSync,
  input: InitializeAdminInput,
  dependencies: CredentialDependencies,
): Promise<AdminSetupMaterial> {
  const now = dependencies.now?.() ?? Date.now();
  migrateAdminDatabase(database, now);
  if (database.prepare('SELECT 1 FROM admins LIMIT 1').get()) {
    throw new Error('Administrator is already initialized.');
  }

  const username = requireNonEmpty(input.username, 'Username');
  const password = requireNonEmpty(input.password, 'Password');
  if (password.length < 14) throw new Error('Password must be at least 14 characters.');
  const passwordHash = await hashPassword(password, {
    randomBytes: dependencies.randomBytes,
  });
  const setup = createSetupMaterial(dependencies);
  const adminId = 1;

  database.exec('BEGIN IMMEDIATE');
  try {
    database
      .prepare(`
        INSERT INTO admins (
          id,
          username,
          password_hash,
          totp_secret_encrypted,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `)
      .run(
        adminId,
        username,
        passwordHash,
        setup.encryptedTotpSecret,
        now,
        now,
      );
    insertRecoveryCodes(database, adminId, setup.recoveryCodes, now);
    recordAudit(database, adminId, 'auth.admin.initialized', now, username);
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }

  return {
    adminId,
    username,
    totpSecret: setup.totpSecret,
    recoveryCodes: setup.recoveryCodes,
  };
}

export async function resetAdminCredentials(
  database: DatabaseSync,
  input: ResetAdminInput,
  dependencies: CredentialDependencies,
): Promise<AdminSetupMaterial> {
  const now = dependencies.now?.() ?? Date.now();
  migrateAdminDatabase(database, now);
  const existing = database
    .prepare('SELECT id, username FROM admins LIMIT 1')
    .get() as { id: number; username: string } | undefined;
  if (!existing) {
    throw new Error('Administrator is not initialized.');
  }

  const username = input.username === undefined
    ? existing.username
    : requireNonEmpty(input.username, 'Username');
  const password = requireNonEmpty(input.password, 'Password');
  if (password.length < 14) throw new Error('Password must be at least 14 characters.');
  const passwordHash = await hashPassword(password, {
    randomBytes: dependencies.randomBytes,
  });
  const setup = createSetupMaterial(dependencies);

  database.exec('BEGIN IMMEDIATE');
  try {
    database
      .prepare(`
        UPDATE admins
        SET username = ?, password_hash = ?, totp_secret_encrypted = ?, updated_at = ?
        WHERE id = ?
      `)
      .run(
        username,
        passwordHash,
        setup.encryptedTotpSecret,
        now,
        existing.id,
      );
    database
      .prepare('UPDATE sessions SET revoked_at = ? WHERE revoked_at IS NULL')
      .run(now);
    database.prepare('DELETE FROM recovery_codes WHERE admin_id = ?').run(existing.id);
    insertRecoveryCodes(database, existing.id, setup.recoveryCodes, now);
    database.prepare('DELETE FROM login_attempts').run();
    recordAudit(
      database,
      existing.id,
      'auth.admin.credentials-reset',
      now,
      username,
    );
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }

  return {
    adminId: existing.id,
    username,
    totpSecret: setup.totpSecret,
    recoveryCodes: setup.recoveryCodes,
  };
}
