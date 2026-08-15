import { createHmac, timingSafeEqual } from 'node:crypto';

const base32Alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

interface TotpOptions {
  digits?: number;
  periodSeconds?: number;
}

function decodeBase32(value: string): Buffer {
  const normalized = value.toUpperCase().replace(/[\s=-]/gu, '');
  let bits = 0;
  let bitCount = 0;
  const bytes: number[] = [];

  for (const character of normalized) {
    const index = base32Alphabet.indexOf(character);
    if (index < 0) {
      throw new Error('Invalid Base32 TOTP secret.');
    }
    bits = (bits << 5) | index;
    bitCount += 5;
    if (bitCount >= 8) {
      bitCount -= 8;
      bytes.push((bits >>> bitCount) & 0xff);
      bits &= (1 << bitCount) - 1;
    }
  }

  return Buffer.from(bytes);
}

export function generateTotp(
  secret: string,
  nowMs: number,
  options: TotpOptions = {},
): string {
  const digits = options.digits ?? 6;
  const periodSeconds = options.periodSeconds ?? 30;
  if (!Number.isInteger(digits) || digits < 6 || digits > 10) {
    throw new Error('TOTP digits must be an integer between 6 and 10.');
  }
  if (!Number.isInteger(periodSeconds) || periodSeconds <= 0) {
    throw new Error('TOTP period must be a positive integer.');
  }

  const counter = BigInt(Math.floor(nowMs / 1000 / periodSeconds));
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(counter);
  const digest = createHmac('sha1', decodeBase32(secret))
    .update(counterBuffer)
    .digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = digest.readUInt32BE(offset) & 0x7fffffff;
  const modulus = 10 ** digits;
  return String(binary % modulus).padStart(digits, '0');
}

export function verifyTotp(
  code: string,
  secret: string,
  nowMs: number,
  options: TotpOptions & { window?: number } = {},
): boolean {
  const digits = options.digits ?? 6;
  if (!new RegExp(`^\\d{${digits}}$`, 'u').test(code)) {
    return false;
  }

  const periodSeconds = options.periodSeconds ?? 30;
  const window = options.window ?? 1;
  const candidate = Buffer.from(code, 'utf8');
  for (let offset = -window; offset <= window; offset += 1) {
    const expected = Buffer.from(generateTotp(
      secret,
      nowMs + offset * periodSeconds * 1000,
      { digits, periodSeconds },
    ), 'utf8');
    if (timingSafeEqual(candidate, expected)) {
      return true;
    }
  }

  return false;
}
