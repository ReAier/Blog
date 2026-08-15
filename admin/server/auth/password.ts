import {
  argon2,
  randomBytes as cryptoRandomBytes,
  timingSafeEqual,
} from 'node:crypto';

export const ARGON2ID_PARAMETERS = Object.freeze({
  memory: 64 * 1024,
  passes: 3,
  parallelism: 1,
  tagLength: 32,
  saltLength: 16,
});

interface PasswordDependencies {
  randomBytes?: (size: number) => Buffer;
}

function deriveArgon2id(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    argon2('argon2id', {
      message: Buffer.from(password, 'utf8'),
      nonce: salt,
      parallelism: ARGON2ID_PARAMETERS.parallelism,
      tagLength: ARGON2ID_PARAMETERS.tagLength,
      memory: ARGON2ID_PARAMETERS.memory,
      passes: ARGON2ID_PARAMETERS.passes,
    }, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(derivedKey);
    });
  });
}

function encodeBase64(value: Buffer): string {
  return value.toString('base64').replace(/=+$/u, '');
}

function decodeBase64(value: string): Buffer {
  return Buffer.from(value, 'base64');
}

export async function hashPassword(
  password: string,
  dependencies: PasswordDependencies = {},
): Promise<string> {
  const randomBytes = dependencies.randomBytes ?? cryptoRandomBytes;
  const salt = randomBytes(ARGON2ID_PARAMETERS.saltLength);
  const digest = await deriveArgon2id(password, salt);

  return [
    '$argon2id',
    '$v=19',
    `$m=${ARGON2ID_PARAMETERS.memory},t=${ARGON2ID_PARAMETERS.passes},p=${ARGON2ID_PARAMETERS.parallelism}`,
    `$${encodeBase64(salt)}`,
    `$${encodeBase64(digest)}`,
  ].join('');
}

export async function verifyPassword(
  password: string,
  encodedHash: string,
): Promise<boolean> {
  const match = /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)$/u.exec(encodedHash);
  if (!match) {
    return false;
  }

  const [, memory, passes, parallelism, encodedSalt, encodedDigest] = match;
  if (
    Number(memory) !== ARGON2ID_PARAMETERS.memory
    || Number(passes) !== ARGON2ID_PARAMETERS.passes
    || Number(parallelism) !== ARGON2ID_PARAMETERS.parallelism
  ) {
    return false;
  }

  try {
    const salt = decodeBase64(encodedSalt);
    const expectedDigest = decodeBase64(encodedDigest);
    if (
      salt.length !== ARGON2ID_PARAMETERS.saltLength
      || expectedDigest.length !== ARGON2ID_PARAMETERS.tagLength
    ) {
      return false;
    }

    const actualDigest = await deriveArgon2id(password, salt);
    return timingSafeEqual(actualDigest, expectedDigest);
  } catch {
    return false;
  }
}
