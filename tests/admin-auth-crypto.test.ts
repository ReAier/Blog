import { describe, expect, it } from 'vitest';
import {
  ARGON2ID_PARAMETERS,
  hashPassword,
  verifyPassword,
} from '../admin/server/auth/password';
import {
  decryptTotpSecret,
  encryptTotpSecret,
} from '../admin/server/auth/totp-secret';
import {
  generateTotp,
  verifyTotp,
} from '../admin/server/auth/totp';
import {
  generateRecoveryCodes,
  hashRecoveryCode,
  verifyRecoveryCode,
} from '../admin/server/auth/recovery-codes';

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

describe('password hashing', () => {
  it('uses the required Argon2id cost parameters and verifies the password', async () => {
    const encoded = await hashPassword('correct horse battery staple', {
      randomBytes: deterministicRandom(1),
    });

    expect(ARGON2ID_PARAMETERS).toEqual({
      memory: 64 * 1024,
      passes: 3,
      parallelism: 1,
      tagLength: 32,
      saltLength: 16,
    });
    expect(encoded).toMatch(/^\$argon2id\$v=19\$m=65536,t=3,p=1\$/);
    await expect(verifyPassword('correct horse battery staple', encoded)).resolves.toBe(true);
    await expect(verifyPassword('incorrect', encoded)).resolves.toBe(false);
  });

  it('rejects malformed password hashes instead of throwing', async () => {
    await expect(verifyPassword('password', 'not-a-phc-string')).resolves.toBe(false);
  });
});

describe('TOTP secret protection and verification', () => {
  it('encrypts the secret with AES-256-GCM and detects tampering', () => {
    const key = Buffer.alloc(32, 7);
    const encrypted = encryptTotpSecret('JBSWY3DPEHPK3PXP', key, {
      randomBytes: deterministicRandom(20),
    });

    expect(encrypted).toMatch(/^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(encrypted).not.toContain('JBSWY3DPEHPK3PXP');
    expect(decryptTotpSecret(encrypted, key)).toBe('JBSWY3DPEHPK3PXP');

    const pieces = encrypted.split('.');
    pieces[3] = `${pieces[3].slice(0, -1)}${pieces[3].endsWith('A') ? 'B' : 'A'}`;
    expect(() => decryptTotpSecret(pieces.join('.'), key)).toThrow();
  });

  it('matches the RFC 6238 SHA-1 vector and permits one adjacent time step', () => {
    const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

    expect(generateTotp(secret, 59_000, { digits: 8 })).toBe('94287082');

    const code = generateTotp(secret, 1_234_560_000);
    expect(verifyTotp(code, secret, 1_234_560_000)).toBe(true);
    expect(verifyTotp(code, secret, 1_234_590_000)).toBe(true);
    expect(verifyTotp(code, secret, 1_234_620_000)).toBe(false);
  });
});

describe('recovery codes', () => {
  it('generates human-readable high-entropy codes and stores verifiable hashes', () => {
    const codes = generateRecoveryCodes(3, {
      randomBytes: deterministicRandom(40),
    });

    expect(codes).toHaveLength(3);
    expect(new Set(codes).size).toBe(3);
    for (const code of codes) {
      expect(code).toMatch(/^[A-Z2-9]{5}-[A-Z2-9]{5}-[A-Z2-9]{5}-[A-Z2-9]{5}$/);
      const hash = hashRecoveryCode(code);
      expect(hash).not.toContain(code);
      expect(verifyRecoveryCode(code.toLowerCase(), hash)).toBe(true);
      expect(verifyRecoveryCode(`${code}X`, hash)).toBe(false);
    }
  });
});
