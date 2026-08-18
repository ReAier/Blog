import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { adminRolePermissions, createAdminKey, listAdminKeys, revokeAdminKey, type AdminRole } from '../server/auth/admin-keys';
import { createAdminConfig } from '../server/config';
import { migrateAdminDatabase } from '../server/db/migrations';
import { readCliOption } from './options';

async function main() {
  const action = process.argv[2];
  const dataRoot = readCliOption(process.argv, '--data-root');
  const config = createAdminConfig(dataRoot ? { dataRoot } : {});
  await mkdir(dirname(config.statePath), { recursive: true });
  const database = new DatabaseSync(config.statePath);
  try {
    migrateAdminDatabase(database);
    process.stdout.write(`Admin database: ${config.statePath}\n`);
    if (action === 'list') {
      process.stdout.write(`${JSON.stringify(listAdminKeys(database), null, 2)}\n`);
      return;
    }
    if (action === 'revoke') {
      const id = readCliOption(process.argv, '--id');
      if (!id || !revokeAdminKey(database, id)) throw new Error('A valid --id is required.');
      process.stdout.write(`Revoked admin key ${id}.\n`);
      return;
    }
    if (action !== 'create') throw new Error('Usage: npm run admin:key -- create|list|revoke [--data-root <path>]');
    const role = (readCliOption(process.argv, '--role') ?? 'owner') as AdminRole;
    if (role === 'custom' || !(role in adminRolePermissions)) throw new Error('--role must be viewer, editor, publisher or owner.');
    const expiry = readCliOption(process.argv, '--expires') ?? 'permanent';
    if (!['7', '30', '365', 'permanent'].includes(expiry)) throw new Error('--expires must be 7, 30, 365 or permanent.');
    const created = createAdminKey(database, {
      name: readCliOption(process.argv, '--name') ?? 'SSH recovery owner',
      role,
      permissions: [...adminRolePermissions[role]],
      expiresInDays: expiry === 'permanent' ? null : Number(expiry) as 7 | 30 | 365,
    });
    process.stdout.write(`Admin key (shown once):\n${created.key}\n`);
  } finally {
    database.close();
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});

