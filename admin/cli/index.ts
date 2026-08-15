import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { emitKeypressEvents } from 'node:readline';
import { createInterface } from 'node:readline/promises';
import { DatabaseSync } from 'node:sqlite';
import QRCode from 'qrcode';
import { initializeAdmin, resetAdminCredentials } from './admin-credentials';
import { prepareAdminSetup } from '../server/auth/setup';
import { createAdminConfig } from '../server/config';
import { configuredCliPassword, hasCliFlag, readCliOption } from './options';

async function question(label: string, fallback?: string): Promise<string> {
  if (!process.stdin.isTTY) return fallback ?? '';
  const input = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await input.question(fallback ? `${label} [${fallback}]: ` : `${label}: `)).trim()
      || fallback
      || '';
  } finally {
    input.close();
  }
}

async function hiddenQuestion(label: string): Promise<string> {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
    throw new Error('Password input requires an interactive TTY.');
  }
  emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdout.write(`${label}: `);
  return new Promise((resolve, reject) => {
    let value = '';
    const finish = (error?: Error) => {
      process.stdin.off('keypress', onKeypress);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write('\n');
      if (error) reject(error);
      else resolve(value);
    };
    const onKeypress = (text: string, key: { name?: string; ctrl?: boolean }) => {
      if (key.ctrl && key.name === 'c') {
        finish(new Error('Cancelled.'));
        return;
      }
      if (key.name === 'return' || key.name === 'enter') {
        finish();
        return;
      }
      if (key.name === 'backspace') {
        if (value) {
          value = value.slice(0, -1);
          process.stdout.write('\b \b');
        }
        return;
      }
      if (text && !key.ctrl) {
        value += text;
        process.stdout.write('*');
      }
    };
    process.stdin.on('keypress', onKeypress);
  });
}

async function main(): Promise<void> {
  const command = process.argv[2];
  if (command !== 'init' && command !== 'reset' && command !== 'prepare-setup') {
    throw new Error('Usage: npm run admin:init, npm run admin:reset, or npm run admin:prepare-setup -- [--replace-admin]');
  }
  const config = createAdminConfig();
  if (!config.masterKey || config.masterKey.byteLength !== 32) {
    throw new Error('ADMIN_MASTER_KEY must be a 32-byte hex or base64 key.');
  }
  await mkdir(dirname(config.statePath), { recursive: true });
  const database = new DatabaseSync(config.statePath);
  try {
    if (command === 'prepare-setup') {
      const prepared = prepareAdminSetup(database, {
        encryptionKey: config.masterKey,
      }, {
        replaceAdmin: hasCliFlag(process.argv, '--replace-admin'),
      });
      const setupUrl = `${config.publicOrigin.replace(/\/$/u, '')}/setup#token=${encodeURIComponent(prepared.token)}`;
      process.stdout.write([
        '',
        'One-time administrator setup prepared.',
        `Expires: ${new Date(prepared.expiresAt).toISOString()}`,
        `Setup token: ${prepared.token}`,
        `Setup URL: ${setupUrl}`,
        '',
        'The token is shown once. Store it only long enough to finish setup.',
        '',
      ].join('\n'));
      return;
    }

    const hasAdminsTable = Boolean(database.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'admins'",
    ).get());
    const current = hasAdminsTable
      ? database.prepare('SELECT username FROM admins LIMIT 1').get() as { username?: string } | undefined
      : undefined;
    const username = readCliOption(process.argv, '--username')
      ?? await question('Administrator username', current?.username ?? 'owner');
    const configuredPassword = configuredCliPassword(process.argv, process.env);
    const password = configuredPassword ?? await hiddenQuestion(
      command === 'init'
        ? 'Password (minimum 14 characters)'
        : 'New password (minimum 14 characters)',
    );
    if (!configuredPassword) {
      const confirmation = await hiddenQuestion('Confirm password');
      if (password !== confirmation) throw new Error('Passwords do not match.');
    }

    const material = command === 'init'
      ? await initializeAdmin(database, { username, password }, { encryptionKey: config.masterKey })
      : await resetAdminCredentials(database, { username, password }, { encryptionKey: config.masterKey });
    const issuer = 'Aier Blog';
    const label = `${issuer}:${material.username}`;
    const otpauthUri = `otpauth://totp/${encodeURIComponent(label)}?secret=${material.totpSecret}&issuer=${encodeURIComponent(issuer)}`;

    process.stdout.write('\nScan this TOTP QR code, then store the recovery codes offline.\n\n');
    process.stdout.write(await QRCode.toString(otpauthUri, { type: 'terminal', small: true }));
    process.stdout.write(`\nTOTP URI: ${otpauthUri}\n\nRecovery codes (shown once):\n${material.recoveryCodes.join('\n')}\n`);
  } finally {
    database.close();
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
