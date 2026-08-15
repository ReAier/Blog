import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';

export const apiTokenScopes = [
  'posts:read',
  'posts:write',
  'clips:read',
  'clips:write',
  'images:read',
  'images:write',
] as const;

export type ApiTokenScope = typeof apiTokenScopes[number];

export interface ApiTokenRecord {
  id: string;
  name: string;
  tokenPrefix: string;
  scopes: ApiTokenScope[];
  createdAt: number;
  expiresAt: number;
  lastUsedAt?: number;
  revokedAt?: number;
}

interface ApiTokenRow {
  id: string;
  name: string;
  token_prefix: string;
  scopes_json: string;
  created_at: number;
  expires_at: number;
  last_used_at: number | null;
  revoked_at: number | null;
}

const scopeSet = new Set<string>(apiTokenScopes);
const dayMs = 86_400_000;

function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('base64url');
}

function normalizeScopes(scopes: readonly ApiTokenScope[]): ApiTokenScope[] {
  const unique = [...new Set(scopes)];
  if (!unique.length || unique.some((scope) => !scopeSet.has(scope))) {
    throw new Error('At least one valid API token scope is required.');
  }
  return unique;
}

function presentToken(row: ApiTokenRow): ApiTokenRecord {
  return {
    id: row.id,
    name: row.name,
    tokenPrefix: row.token_prefix,
    scopes: JSON.parse(row.scopes_json) as ApiTokenScope[],
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    lastUsedAt: row.last_used_at ?? undefined,
    revokedAt: row.revoked_at ?? undefined,
  };
}

export function createApiToken(
  database: DatabaseSync,
  input: { name: string; scopes: ApiTokenScope[]; expiresInDays?: number },
  now = Date.now(),
): { token: string; record: ApiTokenRecord } {
  const name = input.name.trim();
  if (!name || name.length > 100) throw new Error('API token name must be between 1 and 100 characters.');
  const expiresInDays = input.expiresInDays ?? 30;
  if (!Number.isInteger(expiresInDays) || expiresInDays < 1 || expiresInDays > 365) {
    throw new Error('API token expiry must be between 1 and 365 days.');
  }
  const scopes = normalizeScopes(input.scopes);
  const secret = randomBytes(32).toString('base64url');
  const token = `aier_pat_${secret}`;
  const record: ApiTokenRecord = {
    id: randomUUID(),
    name,
    tokenPrefix: `aier_pat_${secret.slice(0, 8)}`,
    scopes,
    createdAt: now,
    expiresAt: now + expiresInDays * dayMs,
    lastUsedAt: undefined,
    revokedAt: undefined,
  };
  database.prepare(`
    INSERT INTO api_tokens (
      id, name, token_prefix, token_hash, scopes_json,
      created_at, expires_at, last_used_at, revoked_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL)
  `).run(
    record.id,
    record.name,
    record.tokenPrefix,
    hashToken(token),
    JSON.stringify(record.scopes),
    record.createdAt,
    record.expiresAt,
  );
  return { token, record };
}

export function listApiTokens(database: DatabaseSync): ApiTokenRecord[] {
  const rows = database.prepare(`
    SELECT id, name, token_prefix, scopes_json, created_at,
           expires_at, last_used_at, revoked_at
    FROM api_tokens
    ORDER BY created_at DESC, id DESC
  `).all() as unknown as ApiTokenRow[];
  return rows.map(presentToken);
}

export function revokeApiToken(database: DatabaseSync, id: string, now = Date.now()): boolean {
  const result = database.prepare(`
    UPDATE api_tokens
    SET revoked_at = COALESCE(revoked_at, ?)
    WHERE id = ?
  `).run(now, id);
  return result.changes === 1;
}

export function resolveApiToken(
  database: DatabaseSync,
  token: string,
  now = Date.now(),
): ApiTokenRecord | null {
  if (!token.startsWith('aier_pat_')) return null;
  const row = database.prepare(`
    SELECT id, name, token_prefix, scopes_json, created_at,
           expires_at, last_used_at, revoked_at
    FROM api_tokens
    WHERE token_hash = ?
  `).get(hashToken(token)) as unknown as ApiTokenRow | undefined;
  if (!row || row.revoked_at !== null || row.expires_at <= now) return null;
  database.prepare('UPDATE api_tokens SET last_used_at = ? WHERE id = ?').run(now, row.id);
  return { ...presentToken(row), lastUsedAt: now };
}

export function authenticateApiToken(
  database: DatabaseSync,
  token: string,
  requiredScope: ApiTokenScope,
  now = Date.now(),
): ApiTokenRecord | null {
  const record = resolveApiToken(database, token, now);
  return record?.scopes.includes(requiredScope) ? record : null;
}
