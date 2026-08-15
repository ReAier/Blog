import {
  createHash,
  randomBytes as cryptoRandomBytes,
  timingSafeEqual,
} from 'node:crypto';

const recoveryAlphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const charactersPerCode = 20;
const bytesPerCode = 13;

interface RecoveryCodeDependencies {
  randomBytes?: (size: number) => Buffer;
}

function normalizeRecoveryCode(code: string): string {
  return code.replace(/[\s-]/gu, '').toUpperCase();
}

function encodeRecoveryBytes(bytes: Buffer): string {
  let bits = 0;
  let bitCount = 0;
  let encoded = '';

  for (const byte of bytes) {
    bits = (bits << 8) | byte;
    bitCount += 8;
    while (bitCount >= 5 && encoded.length < charactersPerCode) {
      bitCount -= 5;
      encoded += recoveryAlphabet[(bits >>> bitCount) & 0x1f];
      bits &= (1 << bitCount) - 1;
    }
  }

  return encoded;
}

export function generateRecoveryCodes(
  count = 10,
  dependencies: RecoveryCodeDependencies = {},
): string[] {
  if (!Number.isInteger(count) || count <= 0) {
    throw new Error('Recovery code count must be a positive integer.');
  }

  const randomBytes = dependencies.randomBytes ?? cryptoRandomBytes;
  const codes = new Set<string>();
  while (codes.size < count) {
    const compact = encodeRecoveryBytes(randomBytes(bytesPerCode));
    codes.add(compact.match(/.{5}/gu)?.join('-') ?? compact);
  }
  return [...codes];
}

export function hashRecoveryCode(code: string): string {
  const normalized = normalizeRecoveryCode(code);
  return `sha256:${createHash('sha256').update(normalized, 'utf8').digest('base64url')}`;
}

export function verifyRecoveryCode(code: string, encodedHash: string): boolean {
  const actualHash = hashRecoveryCode(code);
  const actual = Buffer.from(actualHash, 'utf8');
  const expected = Buffer.from(encodedHash, 'utf8');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
