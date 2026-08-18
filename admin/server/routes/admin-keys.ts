import type { FastifyInstance } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import {
  adminPermissions,
  adminRolePermissions,
  createAdminKey,
  getAdminKey,
  listAdminKeys,
  revokeAdminKey,
  updateAdminKey,
  type AdminPermission,
  type AdminRole,
} from '../auth/admin-keys';
import { adminAuth } from '../http';
import { idParamsSchema, jsonSchema } from '../schemas';

function subset<T>(values: readonly T[], allowed: readonly T[]) {
  const set = new Set(allowed);
  return values.every((value) => set.has(value));
}

export async function registerAdminKeyRoutes(app: FastifyInstance, database: DatabaseSync) {
  app.get('/api/auth/admin-keys', { schema: jsonSchema({ response: 'array' }) }, async () => listAdminKeys(database));
  app.get('/api/auth/admin-key-options', { schema: jsonSchema() }, async () => ({ permissions: adminPermissions, roles: adminRolePermissions }));
  app.post('/api/auth/admin-keys', { schema: jsonSchema() }, async (request, reply) => {
    const auth = adminAuth(request);
    const body = request.body as { name: string; role: AdminRole; permissions: AdminPermission[]; expiresInDays: 7 | 30 | 365 | null };
    if (auth.permissions && !subset(body.permissions, auth.permissions)) return reply.code(403).send({ code: 'PERMISSION_ESCALATION' });
    const parent = auth.keyId ? getAdminKey(database, auth.keyId) : null;
    const requestedExpiry = body.expiresInDays === null ? undefined : Date.now() + body.expiresInDays * 86_400_000;
    if (parent?.expiresAt && (!requestedExpiry || requestedExpiry > parent.expiresAt)) return reply.code(403).send({ code: 'EXPIRY_ESCALATION' });
    return reply.code(201).send(createAdminKey(database, { ...body, createdByKeyId: auth.keyId }));
  });
  app.patch('/api/auth/admin-keys/:id', { schema: jsonSchema({ params: idParamsSchema }) }, async (request, reply) => {
    const auth = adminAuth(request);
    const id = (request.params as { id: string }).id;
    const body = request.body as { name?: string; role?: AdminRole; permissions?: AdminPermission[]; expiresAt?: number | null };
    if (body.permissions && auth.permissions && !subset(body.permissions, auth.permissions)) return reply.code(403).send({ code: 'PERMISSION_ESCALATION' });
    const parent = auth.keyId ? getAdminKey(database, auth.keyId) : null;
    if (parent?.expiresAt && (body.expiresAt === null || (body.expiresAt && body.expiresAt > parent.expiresAt))) return reply.code(403).send({ code: 'EXPIRY_ESCALATION' });
    const updated = updateAdminKey(database, id, body);
    return updated ?? reply.code(404).send({ code: 'ADMIN_KEY_NOT_FOUND' });
  });
  app.delete('/api/auth/admin-keys/:id', { schema: jsonSchema({ params: idParamsSchema }) }, async (request, reply) => {
    const id = (request.params as { id: string }).id;
    if (!revokeAdminKey(database, id)) return reply.code(404).send({ code: 'ADMIN_KEY_NOT_FOUND' });
    return { ok: true, self: adminAuth(request).keyId === id };
  });
}
