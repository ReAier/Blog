import type { FastifyInstance } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import {
  createApiToken,
  listApiTokens,
  revokeApiToken,
  type ApiTokenScope,
} from '../auth/api-tokens';
import { adminAuth } from '../http';
import { apiTokenCreateBodySchema, idParamsSchema, jsonSchema } from '../schemas';

function recordAudit(
  database: DatabaseSync,
  input: { adminId: number; action: string; details: unknown; remoteAddress: string },
): void {
  database.prepare(`
    INSERT INTO audit_logs (admin_id, action, details_json, remote_address, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    database.prepare('SELECT 1 FROM admins WHERE id = ?').get(input.adminId) ? input.adminId : null,
    input.action,
    JSON.stringify(input.details),
    input.remoteAddress,
    Date.now(),
  );
}

export async function registerApiTokenRoutes(
  app: FastifyInstance,
  database: DatabaseSync,
): Promise<void> {
  app.get('/api/auth/tokens', {
    schema: jsonSchema({ response: 'array' }),
  }, async () => listApiTokens(database));

  app.post('/api/auth/tokens', {
    schema: jsonSchema({ body: apiTokenCreateBodySchema }),
  }, async (request, reply) => {
    const body = request.body as {
      name: string;
      scopes: ApiTokenScope[];
      expiresInDays?: number;
    };
    const created = createApiToken(database, body);
    const auth = adminAuth(request);
    recordAudit(database, {
      adminId: auth.adminId,
      action: 'api-token.create',
      details: {
        tokenId: created.record.id,
        name: created.record.name,
        scopes: created.record.scopes,
        expiresAt: created.record.expiresAt,
      },
      remoteAddress: request.ip,
    });
    return reply.code(201).send(created);
  });

  app.delete('/api/auth/tokens/:id', {
    schema: jsonSchema({ params: idParamsSchema }),
  }, async (request, reply) => {
    const id = (request.params as { id: string }).id;
    if (!revokeApiToken(database, id)) {
      return reply.code(404).send({
        code: 'API_TOKEN_NOT_FOUND',
        message: 'The API token does not exist.',
      });
    }
    const auth = adminAuth(request);
    recordAudit(database, {
      adminId: auth.adminId,
      action: 'api-token.revoke',
      details: { tokenId: id },
      remoteAddress: request.ip,
    });
    return { ok: true };
  });
}
