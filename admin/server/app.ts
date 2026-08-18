import { access, mkdir, readdir, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { DatabaseSync } from 'node:sqlite';
import { verifyCsrfRequest } from './auth/csrf';
import { resolveAdminKey } from './auth/admin-keys';
import { requiredAdminPermission } from './auth/permissions';
import {
  createAdminKeySession,
  hashOpaqueToken,
  synchronizeSessionCsrfToken,
  validateSession,
} from './auth/sessions';
import type { AdminConfig } from './config';
import { createAdminConfig } from './config';
import { ContentConflictError, ContentRepositoryError } from './content/errors';
import { recoverInterruptedContentOperations } from './content/operation-log';
import { createContentRepository, type ContentRepository } from './content/repository';
import { migrateAdminDatabase } from './db/migrations';
import { HistoryService } from './history/service';
import { adminAuth, type Authenticated } from './http';
import { BuildGate } from './publish/runner';
import { registerAdminKeyRoutes } from './routes/admin-keys';
import { registerApiTokenRoutes } from './routes/api-tokens';
import { registerApiV1Routes } from './routes/api-v1';
import { registerBackupRoutes } from './routes/backups';
import { registerClipRoutes } from './routes/clips';
import { registerImageRoutes } from './routes/images';
import { registerPostRoutes } from './routes/posts';
import { registerPreviewRoutes } from './routes/previews';
import { registerPublishRoutes } from './routes/publish';
import { registerTrashRoutes } from './routes/trash';
import { cleanupExpiredImageTrash } from './trash/cleanup';
import {
  jsonSchema,
} from './schemas';

const productionSessionCookie = '__Host-aier_admin';
const developmentSessionCookie = 'aier_admin';
const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);
const publicApiRoutes = new Set([
  '/api/health',
  '/api/auth/login',
]);

export interface BuildServerOptions {
  config?: AdminConfig;
  database?: DatabaseSync;
  repository?: ContentRepository;
  authOverride?: (request: FastifyRequest) => Promise<Authenticated | null>;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function directoryBytes(root: string): Promise<number> {
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return 0;
    throw error;
  }
  let bytes = 0;
  for (const entry of entries) {
    const path = resolve(root, entry.name);
    if (entry.isDirectory()) bytes += await directoryBytes(path);
    else if (entry.isFile()) bytes += (await stat(path)).size;
  }
  return bytes;
}

function requestIp(request: FastifyRequest): string {
  return request.ip || request.socket.remoteAddress || 'unknown';
}

function sessionCookieName(config: AdminConfig): string {
  return config.secureCookies ? productionSessionCookie : developmentSessionCookie;
}

function sessionCookieOptions(config: AdminConfig) {
  return {
    path: '/',
    httpOnly: true,
    secure: config.secureCookies,
    sameSite: 'strict' as const,
    maxAge: 7 * 24 * 60 * 60,
  };
}

export async function buildServer(options: BuildServerOptions = {}): Promise<FastifyInstance> {
  const config = options.config ?? createAdminConfig();
  await Promise.all([
    mkdir(dirname(config.statePath), { recursive: true }),
    mkdir(config.historyRoot, { recursive: true }),
    mkdir(config.trashRoot, { recursive: true }),
    mkdir(config.jobsRoot, { recursive: true }),
    mkdir(config.previewsRoot, { recursive: true }),
    mkdir(resolve(config.contentRoot, 'blog'), { recursive: true }),
    mkdir(resolve(config.contentRoot, 'clips'), { recursive: true }),
    mkdir(resolve(config.contentRoot, 'images'), { recursive: true }),
  ]);

  await recoverInterruptedContentOperations({
    contentRoot: config.contentRoot,
    operationsRoot: resolve(config.jobsRoot, 'operations'),
  });
  await cleanupExpiredImageTrash(config.trashRoot);

  const database = options.database ?? new DatabaseSync(config.statePath);
  migrateAdminDatabase(database);
  const repository = options.repository ?? createContentRepository({ root: config.contentRoot });
  const history = new HistoryService({
    database,
    blobRoot: config.historyRoot,
    maxVersions: 100,
  });
  const buildGate = new BuildGate();
  const failedKeyLogins = new Map<string, { count: number; resetAt: number }>();
  const app = Fastify({
    logger: process.env.NODE_ENV === 'test' ? false : true,
    trustProxy: true,
    bodyLimit: 6 * 1024 * 1024,
  });

  await app.register(cookie);
  await app.register(multipart, {
    limits: {
      files: 1,
      fileSize: 256 * 1024 * 1024,
      fields: 20,
    },
  });
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'"],
        frameSrc: ["'self'"],
        frameAncestors: ["'none'"],
        baseUri: ["'none'"],
        formAction: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  });

  const resolveAuth = async (request: FastifyRequest): Promise<Authenticated | null> => {
    if (options.authOverride) return options.authOverride(request);
    const token = request.cookies[sessionCookieName(config)];
    if (!token) return null;
    const session = validateSession(database, token);
    if (!session) return null;
    if (!session.adminKeyId) return null;
    const key = database.prepare('SELECT id, name, role, permissions_json, expires_at, revoked_at FROM admin_keys WHERE id = ?').get(session.adminKeyId) as {
      id: string; name: string; role: Authenticated['role']; permissions_json: string;
      expires_at: number | null; revoked_at: number | null;
    } | undefined;
    if (!key || key.revoked_at !== null || (key.expires_at !== null && key.expires_at <= Date.now())) return null;
    return {
      adminId: session.adminId,
      username: key.name,
      keyId: key.id,
      role: key.role,
      permissions: JSON.parse(key.permissions_json),
      csrfTokenHash: session.csrfTokenHash,
      sessionId: session.id,
    };
  };

  app.decorateRequest('adminAuth', null);
  app.addHook('preHandler', async (request, reply) => {
    const routeUrl = request.routeOptions.url;
    if (
      !routeUrl?.startsWith('/api/')
      || routeUrl.startsWith('/api/v1/')
      || publicApiRoutes.has(routeUrl)
    ) return;
    const auth = await resolveAuth(request);
    if (!auth) {
      return reply.code(401).send({
        code: 'AUTH_REQUIRED',
        message: 'Authentication is required.',
      });
    }
    (request as FastifyRequest & { adminAuth: Authenticated }).adminAuth = auth;
    const requiredPermission = requiredAdminPermission(request.method, routeUrl);
    if (requiredPermission && auth.permissions && !auth.permissions.includes(requiredPermission)) {
      return reply.code(403).send({
        code: 'PERMISSION_DENIED',
        message: `The ${requiredPermission} permission is required.`,
      });
    }
    if (!safeMethods.has(request.method) && !verifyCsrfRequest({
      method: request.method,
      origin: request.headers.origin,
      allowedOrigins: [config.publicOrigin],
      csrfToken: request.headers['x-csrf-token'] as string | undefined,
      csrfTokenHash: auth.csrfTokenHash
        ?? (auth.csrfToken ? hashOpaqueToken(auth.csrfToken) : undefined),
    })) {
      return reply.code(403).send({
        code: 'CSRF_REJECTED',
        message: 'The request origin or CSRF token is invalid.',
      });
    }
  });

  app.addHook('onSend', async (request, reply, payload) => {
    if (reply.statusCode < 400 || typeof payload !== 'string') return payload;
    const contentType = String(reply.getHeader('content-type') ?? '');
    if (!contentType.includes('application/json')) return payload;
    try {
      const errorBody = JSON.parse(payload) as Record<string, unknown>;
      if (typeof errorBody.code !== 'string') return payload;
      return JSON.stringify({
        ...errorBody,
        message: typeof errorBody.message === 'string' && errorBody.message.trim()
          ? errorBody.message
          : 'Request failed.',
        requestId: typeof errorBody.requestId === 'string' ? errorBody.requestId : request.id,
      });
    } catch {
      return payload;
    }
  });

  app.setErrorHandler((error, _request, reply) => {
    const validation = (error as { validation?: unknown[] }).validation;
    if (Array.isArray(validation)) {
      return reply.code(400).send({
        code: 'VALIDATION_ERROR',
        message: 'The request did not match the API schema.',
        details: validation,
      });
    }
    if ((error as { code?: string }).code === 'FST_REQ_FILE_TOO_LARGE') {
      return reply.code(413).send({
        code: 'UPLOAD_TOO_LARGE',
        message: 'The uploaded file exceeds the configured size limit.',
      });
    }
    if (error instanceof ContentConflictError) {
      return reply.code(409).send({
        code: 'REVISION_CONFLICT',
        message: error.message,
        details: error.details,
        revision: error.details?.actualRevision,
      });
    }
    if (error instanceof ContentRepositoryError) {
      const status = error.code === 'CONTENT_NOT_FOUND'
        ? 404
        : error.code === 'CONTENT_DUPLICATE'
          ? 409
          : error.code === 'CONTENT_TOO_LARGE'
            ? 413
            : 400;
      return reply.code(status).send({
        code: error.code,
        message: error.message,
        details: error.details,
      });
    }
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return reply.code(404).send({
        code: 'NOT_FOUND',
        message: 'The requested file does not exist.',
      });
    }
    app.log.error(error);
    return reply.code(500).send({
      code: 'INTERNAL_ERROR',
      message: 'Unexpected server error.',
    });
  });

  app.get('/api/health', { schema: jsonSchema() }, async () => ({ ok: true }));

  app.post('/api/auth/login', { schema: jsonSchema() }, async (request, reply) => {
    const keyText = (request.body as { key?: string })?.key?.trim();
    const limiterKey = `${requestIp(request)}:${keyText?.slice(0, 11) ?? 'missing'}`;
    const now = Date.now();
    const attempt = failedKeyLogins.get(limiterKey);
    if (attempt && attempt.resetAt > now && attempt.count >= 5) {
      reply.header('retry-after', Math.ceil((attempt.resetAt - now) / 1000));
      return reply.code(429).send({ code: 'LOGIN_RATE_LIMITED', message: 'The administrator key is invalid, expired or revoked.' });
    }
    const key = keyText ? resolveAdminKey(database, keyText, now) : null;
    if (!key) {
      const active = attempt && attempt.resetAt > now ? attempt : { count: 0, resetAt: now + 15 * 60_000 };
      failedKeyLogins.set(limiterKey, { ...active, count: active.count + 1 });
      return reply.code(401).send({
        code: 'INVALID_ADMIN_KEY',
        message: 'The administrator key is invalid, expired or revoked.',
      });
    }
    failedKeyLogins.delete(limiterKey);
    const session = createAdminKeySession(database, key.id);
    reply.setCookie(sessionCookieName(config), session.token, sessionCookieOptions(config));
    return {
      id: key.id,
      username: key.name,
      role: key.role,
      permissions: key.permissions,
      csrfToken: session.csrfToken,
      idleExpiresAt: session.idleExpiresAt,
      absoluteExpiresAt: session.absoluteExpiresAt,
    };
  });

  app.get('/api/auth/session', { schema: jsonSchema() }, async (request) => {
    const auth = adminAuth(request);
    const sessionToken = request.cookies[sessionCookieName(config)];
    const csrfToken = sessionToken && auth.sessionId
      ? synchronizeSessionCsrfToken(database, auth.sessionId, sessionToken)
      : auth.csrfToken;
    return {
      id: auth.keyId,
      username: auth.username,
      role: auth.role,
      permissions: auth.permissions ?? [],
      csrfToken,
    };
  });

  app.post('/api/auth/logout', { schema: jsonSchema() }, async (request, reply) => {
    const auth = adminAuth(request);
    if (auth.sessionId) database.prepare('UPDATE sessions SET revoked_at = ? WHERE id = ?').run(Date.now(), auth.sessionId);
    reply.clearCookie(sessionCookieName(config), sessionCookieOptions(config));
    return { ok: true };
  });
  await registerAdminKeyRoutes(app, database);
  await registerApiTokenRoutes(app, database);
  await registerApiV1Routes(app, { config, database, repository });
  await registerPostRoutes(app, { config, database, repository, history });
  await registerClipRoutes(app, { config, repository, history });
  await registerImageRoutes(app, { config, repository });
  await registerTrashRoutes(app, { config, repository });
  await registerPreviewRoutes(app, config, repository);
  await registerBackupRoutes(app, config);
  const publishRoutes = await registerPublishRoutes(app, { config, database, buildGate });

  app.get('/api/dashboard', { schema: jsonSchema() }, async () => {
    const [posts, clips, images] = await Promise.all([
      repository.listPosts(),
      repository.listClips(),
      repository.listImages(),
    ]);
    const latest = publishRoutes.listJobs()[0];
    const orphanClips = clips
      .filter((clip) => clip.references.length === 0)
      .map((clip) => ({ file: clip.file, slug: clip.slug }));
    return {
      counts: {
        posts: posts.length,
        drafts: posts.filter((post) => post.draft).length,
        clips: clips.length,
        images: images.length,
      },
      orphanClips,
      unreferencedImages: images
        .filter((image) => image.references.length === 0)
        .map((image) => image.path),
      recentPosts: posts
        .sort((left, right) => (
          right.updatedAt ?? right.publishedAt
        ).localeCompare(left.updatedAt ?? left.publishedAt))
        .slice(0, 8)
        .map(({ body: _body, ...post }) => post),
      latestPublish: latest ? {
        id: latest.id,
        status: latest.status,
        startedAt: latest.startedAt ?? latest.createdAt,
        finishedAt: latest.finishedAt,
        contentHash: latest.contentHash,
        release: latest.releaseId,
        log: latest.log.split('\n').filter(Boolean),
      } : undefined,
      storageBytes: await directoryBytes(config.contentRoot),
      clipStorageBytes: await directoryBytes(resolve(config.contentRoot, 'clips')),
      imageStorageBytes: await directoryBytes(resolve(config.contentRoot, 'images')),
    };
  });

  if (await fileExists(config.clientRoot)) {
    await app.register(fastifyStatic, { root: config.clientRoot, wildcard: false });
    app.get('/*', async (request, reply) => {
      if (request.raw.url?.startsWith('/api/')) {
        return reply.code(404).send({ code: 'NOT_FOUND' });
      }
      return reply.sendFile('index.html');
    });
  }

  app.addHook('onClose', async () => {
    if (!options.database) database.close();
  });
  return app;
}

declare module 'fastify' {
  interface FastifyRequest {
    adminAuth: Authenticated | null;
  }
}
