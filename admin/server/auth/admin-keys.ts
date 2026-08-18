import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';

export const adminPermissions = [
  'dashboard:read',
  'posts:read', 'posts:create', 'posts:update', 'posts:delete', 'posts:import', 'posts:download',
  'posts:history:read', 'posts:history:restore', 'posts:slug:update',
  'clips:read', 'clips:create', 'clips:update', 'clips:delete', 'clips:import', 'clips:download',
  'clips:link', 'clips:slug:update',
  'images:read', 'images:upload', 'images:delete',
  'preview:render',
  'trash:read', 'trash:restore', 'trash:purge',
  'publish:read', 'publish:run', 'logs:read',
  'backups:read', 'backups:create', 'backups:download', 'backups:validate', 'backups:apply',
  'ai-keys:read', 'ai-keys:create', 'ai-keys:update', 'ai-keys:revoke',
  'admin-keys:read', 'admin-keys:create', 'admin-keys:update', 'admin-keys:revoke',
] as const;

export type AdminPermission = typeof adminPermissions[number];
export type AdminRole = 'viewer' | 'editor' | 'publisher' | 'owner' | 'custom';

const viewer: AdminPermission[] = [
  'dashboard:read', 'posts:read', 'posts:download', 'posts:history:read',
  'clips:read', 'clips:download', 'images:read', 'trash:read',
  'publish:read', 'logs:read', 'backups:read', 'backups:download',
];
const editor: AdminPermission[] = [...viewer,
  'posts:create', 'posts:update', 'posts:import', 'posts:history:restore', 'posts:slug:update',
  'clips:create', 'clips:update', 'clips:import', 'clips:link', 'clips:slug:update',
  'images:upload', 'preview:render',
];
const publisher: AdminPermission[] = [...editor,
  'posts:delete', 'clips:delete', 'images:delete',
  'trash:restore', 'trash:purge', 'publish:run', 'backups:create', 'backups:validate',
];

export const adminRolePermissions: Record<Exclude<AdminRole, 'custom'>, readonly AdminPermission[]> = {
  viewer,
  editor,
  publisher,
  owner: adminPermissions,
};

export interface AdminKeyRecord {
  id: string;
  name: string;
  keyPrefix: string;
  role: AdminRole;
  permissions: AdminPermission[];
  createdAt: number;
  expiresAt?: number;
  lastUsedAt?: number;
  revokedAt?: number;
  createdByKeyId?: string;
}

interface AdminKeyRow {
  id: string; name: string; key_prefix: string; role: AdminRole; permissions_json: string;
  created_at: number; expires_at: number | null; last_used_at: number | null;
  revoked_at: number | null; created_by_key_id: string | null;
}

const permissionSet = new Set<string>(adminPermissions);
const dayMs = 86_400_000;

function hashKey(key: string) {
  return createHash('sha256').update(key, 'utf8').digest('base64url');
}

function normalizePermissions(permissions: readonly AdminPermission[]): AdminPermission[] {
  const unique = [...new Set(permissions)];
  if (!unique.length || unique.some((permission) => !permissionSet.has(permission))) {
    throw new Error('At least one valid admin permission is required.');
  }
  return unique;
}

function present(row: AdminKeyRow): AdminKeyRecord {
  return {
    id: row.id,
    name: row.name,
    keyPrefix: row.key_prefix,
    role: row.role,
    permissions: JSON.parse(row.permissions_json) as AdminPermission[],
    createdAt: row.created_at,
    expiresAt: row.expires_at ?? undefined,
    lastUsedAt: row.last_used_at ?? undefined,
    revokedAt: row.revoked_at ?? undefined,
    createdByKeyId: row.created_by_key_id ?? undefined,
  };
}

export function createAdminKey(database: DatabaseSync, input: {
  name: string; role: AdminRole; permissions: AdminPermission[];
  expiresInDays: 7 | 30 | 365 | null; createdByKeyId?: string;
}, now = Date.now()): { key: string; record: AdminKeyRecord } {
  const name = input.name.trim();
  if (!name || name.length > 100) throw new Error('Admin key name must be between 1 and 100 characters.');
  const permissions = normalizePermissions(input.permissions);
  if (input.expiresInDays !== null && ![7, 30, 365].includes(input.expiresInDays)) {
    throw new Error('Admin key expiry must be 7, 30, 365 days or permanent.');
  }
  const secret = randomBytes(32).toString('base64url');
  const key = `er-${secret}`;
  const record: AdminKeyRecord = {
    id: randomUUID(), name, keyPrefix: `er-${secret.slice(0, 8)}`, role: input.role,
    permissions, createdAt: now,
    expiresAt: input.expiresInDays === null ? undefined : now + input.expiresInDays * dayMs,
    createdByKeyId: input.createdByKeyId,
  };
  database.prepare(`INSERT INTO admin_keys (
    id, name, key_prefix, key_hash, role, permissions_json, created_at, expires_at, created_by_key_id
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(record.id, name, record.keyPrefix, hashKey(key), record.role, JSON.stringify(permissions),
      now, record.expiresAt ?? null, record.createdByKeyId ?? null);
  return { key, record };
}

export function listAdminKeys(database: DatabaseSync): AdminKeyRecord[] {
  const rows = database.prepare('SELECT id, name, key_prefix, role, permissions_json, created_at, expires_at, last_used_at, revoked_at, created_by_key_id FROM admin_keys ORDER BY created_at DESC').all() as unknown as AdminKeyRow[];
  return rows.map(present);
}

export function getAdminKey(database: DatabaseSync, id: string): AdminKeyRecord | null {
  const row = database.prepare('SELECT id, name, key_prefix, role, permissions_json, created_at, expires_at, last_used_at, revoked_at, created_by_key_id FROM admin_keys WHERE id = ?').get(id) as unknown as AdminKeyRow | undefined;
  return row ? present(row) : null;
}

export function resolveAdminKey(database: DatabaseSync, key: string, now = Date.now()): AdminKeyRecord | null {
  if (!/^er-[A-Za-z0-9_-]{43}$/.test(key)) return null;
  const row = database.prepare('SELECT id, name, key_prefix, role, permissions_json, created_at, expires_at, last_used_at, revoked_at, created_by_key_id FROM admin_keys WHERE key_hash = ?').get(hashKey(key)) as unknown as AdminKeyRow | undefined;
  if (!row || row.revoked_at !== null || (row.expires_at !== null && row.expires_at <= now)) return null;
  database.prepare('UPDATE admin_keys SET last_used_at = ? WHERE id = ?').run(now, row.id);
  return { ...present(row), lastUsedAt: now };
}

export function updateAdminKey(database: DatabaseSync, id: string, input: {
  name?: string; role?: AdminRole; permissions?: AdminPermission[]; expiresAt?: number | null;
}): AdminKeyRecord | null {
  const current = getAdminKey(database, id);
  if (!current || current.revokedAt) return null;
  const name = input.name?.trim() ?? current.name;
  const permissions = input.permissions ? normalizePermissions(input.permissions) : current.permissions;
  database.prepare(`UPDATE admin_keys SET name = ?, role = ?, permissions_json = ?, expires_at = ? WHERE id = ?`)
    .run(name, input.role ?? current.role, JSON.stringify(permissions),
      input.expiresAt === undefined ? current.expiresAt ?? null : input.expiresAt, id);
  return getAdminKey(database, id);
}

export function revokeAdminKey(database: DatabaseSync, id: string, now = Date.now()): boolean {
  const result = database.prepare('UPDATE admin_keys SET revoked_at = COALESCE(revoked_at, ?) WHERE id = ?').run(now, id);
  database.prepare('UPDATE sessions SET revoked_at = COALESCE(revoked_at, ?) WHERE admin_key_id = ?').run(now, id);
  return result.changes === 1;
}

export function hasAdminPermission(record: Pick<AdminKeyRecord, 'permissions'>, permission: AdminPermission) {
  return record.permissions.includes(permission);
}



