import {
  createCipheriv,
  createDecipheriv,
  randomBytes as cryptoRandomBytes,
} from 'node:crypto';

const algorithm = 'aes-256-gcm';
const associatedData = Buffer.from('admin-totp-secret:v1', 'utf8');
const ivLength = 12;

interface TotpSecretDependencies {
  randomBytes?: (size: number) => Buffer;
}

function requireEncryptionKey(key: Buffer): void {
  if (key.length !== 32) {
    throw new Error('TOTP encryption key must be exactly 32 bytes.');
  }
}

export function encryptTotpSecret(
  secret: string,
  key: Buffer,
  dependencies: TotpSecretDependencies = {},
): string {
  requireEncryptionKey(key);
  const randomBytes = dependencies.randomBytes ?? cryptoRandomBytes;
  const iv = randomBytes(ivLength);
  const cipher = createCipheriv(algorithm, key, iv);
  cipher.setAAD(associatedData);
  const ciphertext = Buffer.concat([
    cipher.update(secret, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    'v1',
    iv.toString('base64url'),
    ciphertext.toString('base64url'),
    tag.toString('base64url'),
  ].join('.');
}

export function decryptTotpSecret(encrypted: string, key: Buffer): string {
  requireEncryptionKey(key);
  const [version, encodedIv, encodedCiphertext, encodedTag, extra] = encrypted.split('.');
  if (version !== 'v1' || !encodedIv || !encodedCiphertext || !encodedTag || extra) {
    throw new Error('Invalid encrypted TOTP secret.');
  }

  const iv = Buffer.from(encodedIv, 'base64url');
  const ciphertext = Buffer.from(encodedCiphertext, 'base64url');
  const tag = Buffer.from(encodedTag, 'base64url');
  if (iv.length !== ivLength || tag.length !== 16) {
    throw new Error('Invalid encrypted TOTP secret.');
  }

  const decipher = createDecipheriv(algorithm, key, iv);
  decipher.setAAD(associatedData);
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString('utf8');
}
