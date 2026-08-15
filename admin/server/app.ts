import { access, mkdir, readdir, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { DatabaseSync } from 'node:sqlite';
import { resetAdminCredentials } from '../cli/admin-credentials';
import { authenticateAdmin } from './auth/login';
import { verifyCsrfRequest } from './auth/csrf';
import {
  AdminSetupError,
  beginAdminSetup,
  confirmAdminSetup,
  getAdminSetupStatus,
} from './auth/setup';
import {
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
import { registerApiTokenRoutes } from './routes/api-tokens';
import { registerApiV1Routes } from './routes/api-v1';
import { registerBackupRoutes } from './routes/backups';
import { registerClipRoutes } from './routes/clips';
import { registerImageRoutes } from './routes/images';
import { registerPostRoutes } from './routes/posts';
import { registerPreviewRoutes } from './routes/previews';
import { registerPublishRoutes } from './routes/publish';
import { cleanupExpiredImageTrash } from './trash/cleanup';
import {
  jsonSchema,
  loginBodySchema,
  rotateSecurityBodySchema,
  setupBeginBodySchema,
  setupConfirmBodySchema,
} from './schemas';

const productionSessionCookie = '__Host-aier_admin';
const developmentSessionCookie = 'aier_admin';
const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);
const publicApiRoutes = new Set([
  '/api/health',
  '/api/auth/login',
  '/api/auth/setup/status',
  '/api/auth/setup/begin',
  '/api/auth/setup/confirm',
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
    const administrator = database.prepare('SELECT username FROM admins WHERE id = ?')
      .get(session.adminId) as { username: string } | undefined;
    if (!administrator) return null;
    return {
      adminId: session.adminId,
      username: administrator.username,
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
    if (error instanceof AdminSetupError) {
      const status = error.code === 'SETUP_ALREADY_COMPLETED'
        ? 409
        : error.code === 'INVALID_SETUP_TOKEN'
          || error.code === 'INVALID_SETUP_CHALLENGE'
          || error.code === 'INVALID_TOTP'
          ? 401
          : error.code === 'SETUP_CHALLENGE_EXPIRED'
            ? 410
            : 400;
      return reply.code(status).send({
        code: error.code,
        message: error.message,
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

  app.get('/api/auth/setup/status', { schema: jsonSchema() }, async () => getAdminSetupStatus(database));

  app.post('/api/auth/setup/begin', {
    schema: jsonSchema({ body: setupBeginBodySchema }),
  }, async (request, reply) => {
    if (request.headers.origin !== config.publicOrigin) {
      return reply.code(403).send({
        code: 'SETUP_ORIGIN_REJECTED',
        message: 'The setup request origin is invalid.',
      });
    }
    if (!config.masterKey || config.masterKey.byteLength !== 32) {
      return reply.code(503).send({
        code: 'AUTH_NOT_CONFIGURED',
        message: 'ADMIN_MASTER_KEY is not configured.',
      });
    }
    const body = request.body as {
      token?: string;
      username?: string;
      password?: string;
    };
    if (!body.token || !body.username || !body.password) {
      return reply.code(400).send({
        code: 'INVALID_SETUP_REQUEST',
        message: 'Setup token, username and password are required.',
      });
    }
    return beginAdminSetup(database, {
      token: body.token,
      username: body.username,
      password: body.password,
    }, { encryptionKey: config.masterKey });
  });

  app.post('/api/auth/setup/confirm', {
    schema: jsonSchema({ body: setupConfirmBodySchema }),
  }, async (request, reply) => {
    if (request.headers.origin !== config.publicOrigin) {
      return reply.code(403).send({
        code: 'SETUP_ORIGIN_REJECTED',
        message: 'The setup request origin is invalid.',
      });
    }
    if (!config.masterKey || config.masterKey.byteLength !== 32) {
      return reply.code(503).send({
        code: 'AUTH_NOT_CONFIGURED',
        message: 'ADMIN_MASTER_KEY is not configured.',
      });
    }
    const body = request.body as { challenge?: string; totpCode?: string };
    if (!body.challenge || !body.totpCode) {
      return reply.code(400).send({
        code: 'INVALID_SETUP_CONFIRMATION',
        message: 'Setup challenge and authenticator code are required.',
      });
    }
    const result = confirmAdminSetup(database, {
      challenge: body.challenge,
      totpCode: body.totpCode,
    }, { encryptionKey: config.masterKey });
    reply.setCookie(
      sessionCookieName(config),
      result.session.token,
      sessionCookieOptions(config),
    );
    return reply.code(201).send({
      username: result.username,
      csrfToken: result.session.csrfToken,
      recoveryCodes: result.recoveryCodes,
      idleExpiresAt: result.session.idleExpiresAt,
      absoluteExpiresAt: result.session.absoluteExpiresAt,
    });
  });
  app.post('/api/auth/login', { schema: jsonSchema({ body: loginBodySchema }) }, async (request, reply) => {
    if (!config.masterKey || config.masterKey.byteLength !== 32) {
      return reply.code(503).send({
        code: 'AUTH_NOT_CONFIGURED',
        message: 'ADMIN_MASTER_KEY is not configured.',
      });
    }
    const body = request.body as {
      username?: string;
      password?: string;
      totp?: string;
      recoveryCode?: string;
      secondFactor?: { type?: 'totp' | 'recovery-code'; code?: string };
    };
    const secondFactor = body.secondFactor?.type && body.secondFactor.code
      ? { type: body.secondFactor.type, code: body.secondFactor.code }
      : body.totp
        ? { type: 'totp' as const, code: body.totp }
        : body.recoveryCode
          ? { type: 'recovery-code' as const, code: body.recoveryCode }
          : undefined;
    if (!body.username || !body.password || !secondFactor) {
      return reply.code(400).send({
        code: 'INVALID_LOGIN_REQUEST',
        message: 'Username, password and a second factor are required.',
      });
    }
    const result = await authenticateAdmin(database, {
      username: body.username,
      password: body.password,
      secondFactor,
      remoteAddress: requestIp(request),
    }, { encryptionKey: config.masterKey });
    if (!result.ok) {
      if (result.reason === 'locked') {
        reply.header('retry-after', Math.ceil(result.retryAfterMs / 1000));
      }
      return reply.code(result.reason === 'locked' ? 429 : 401).send({
        ...result,
        message: 'Invalid credentials or second factor.',
      });
    }
    reply.setCookie(
      sessionCookieName(config),
      result.session.token,
      sessionCookieOptions(config),
    );
    return {
      username: body.username,
      csrfToken: result.session.csrfToken,
      idleExpiresAt: result.session.idleExpiresAt,
      absoluteExpiresAt: result.session.absoluteExpiresAt,
    };
  });

  app.get('/api/auth/session', { schema: jsonSchema() }, async (request) => {
    const auth = adminAuth(request);
    const sessionToken = request.cookies[sessionCookieName(config)];
    const csrfToken = sessionToken && auth.sessionId
      ? synchronizeSessionCsrfToken(database, auth.sessionId, sessionToken)
      : auth.csrfToken;
    return { username: auth.username, csrfToken };
  });

  app.post('/api/auth/logout', { schema: jsonSchema() }, async (request, reply) => {
    const auth = adminAuth(request);
    if (auth.sessionId) {
      database.prepare('UPDATE sessions SET revoked_at = ? WHERE id = ?')
        .run(Date.now(), auth.sessionId);
    }
    reply.clearCookie(sessionCookieName(config), sessionCookieOptions(config));
    return { ok: true };
  });

  app.post('/api/auth/security/rotate', {
    schema: jsonSchema({ body: rotateSecurityBodySchema }),
  }, async (request, reply) => {
    if (!config.masterKey || config.masterKey.byteLength !== 32) {
      return reply.code(503).send({ code: 'AUTH_NOT_CONFIGURED' });
    }
    const auth = adminAuth(request);
    const body = request.body as {
      currentPassword?: string;
      newPassword?: string;
      username?: string;
      totp?: string;
      recoveryCode?: string;
    };
    const secondFactor = body.totp
      ? { type: 'totp' as const, code: body.totp }
      : body.recoveryCode
        ? { type: 'recovery-code' as const, code: body.recoveryCode }
        : undefined;
    if (!body.currentPassword || !body.newPassword || !secondFactor) {
      return reply.code(400).send({ code: 'INVALID_ROTATION_REQUEST' });
    }
    const verified = await authenticateAdmin(database, {
      username: auth.username,
      password: body.currentPassword,
      secondFactor,
      remoteAddress: requestIp(request),
    }, { encryptionKey: config.masterKey });
    if (!verified.ok) return reply.code(401).send({ code: 'REAUTHENTICATION_FAILED' });
    const material = await resetAdminCredentials(database, {
      username: body.username,
      password: body.newPassword,
    }, { encryptionKey: config.masterKey });
    reply.clearCookie(sessionCookieName(config), sessionCookieOptions(config));
    return {
      username: material.username,
      totpSecret: material.totpSecret,
      otpauthUri: `otpauth://totp/${encodeURIComponent(`Aier Blog:${material.username}`)}?secret=${material.totpSecret}&issuer=${encodeURIComponent('Aier Blog')}`,
      recoveryCodes: material.recoveryCodes,
    };
  });

  await registerApiTokenRoutes(app, database);
  await registerApiV1Routes(app, { config, database, repository });
  await registerPostRoutes(app, { config, database, repository, history });
  await registerClipRoutes(app, { config, repository, history });
  await registerImageRoutes(app, { config, repository });
  await registerPreviewRoutes(app, config);
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
