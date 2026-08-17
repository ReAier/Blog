import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import { extname } from 'node:path';
import {
  resolveApiToken,
  type ApiTokenRecord,
  type ApiTokenScope,
} from '../auth/api-tokens';
import { ApiTokenRateLimiter, type ApiRateLimitKind } from '../auth/api-rate-limit';
import type { AdminConfig } from '../config';
import type { ContentRepository } from '../content/repository';
import { createClipTransaction, updateClipTransaction } from '../content/transactions';
import { paged, presentClip, presentImage } from '../http';
import { ImageService } from '../images/service';
import { configuredUploadLimit, MAX_IMAGE_BYTES } from '../limits';
import { createApiV1OpenApiDocument } from '../openapi';
import {
  apiV1ClipCreateBodySchema,
  apiV1ClipUpdateBodySchema,
  apiV1PostCreateBodySchema,
  apiV1PostListQuerySchema,
  apiV1PostUpdateBodySchema,
  clipListQuerySchema,
  imageListQuerySchema,
  jsonSchema,
  slugParamsSchema,
} from '../schemas';

interface ApiTokenRequest extends FastifyRequest {
  apiTokenAuth?: ApiTokenRecord;
}

function bearerToken(request: FastifyRequest): string | undefined {
  const authorization = request.headers.authorization;
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim();
}

function requireScope(
  database: DatabaseSync,
  limiter: ApiTokenRateLimiter,
  scope: ApiTokenScope,
  kind: ApiRateLimitKind = 'regular',
) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const token = bearerToken(request);
    if (!token) {
      return reply.code(401).send({
        code: 'API_TOKEN_REQUIRED',
        message: 'A Bearer API token is required.',
      });
    }
    const record = resolveApiToken(database, token);
    if (!record) {
      return reply.code(401).send({
        code: 'API_TOKEN_INVALID',
        message: 'The API token is invalid, expired or revoked.',
      });
    }
    if (!record.scopes.includes(scope)) {
      return reply.code(403).send({
        code: 'API_SCOPE_REQUIRED',
        message: `The API token requires the ${scope} scope.`,
        details: { requiredScope: scope },
      });
    }
    const rateLimit = limiter.consume(record.id, kind);
    reply
      .header('x-ratelimit-limit', rateLimit.limit)
      .header('x-ratelimit-remaining', rateLimit.remaining)
      .header('x-ratelimit-reset', Math.ceil(rateLimit.resetAt / 1000));
    if (!rateLimit.allowed) {
      reply.header('retry-after', Math.max(1, Math.ceil((rateLimit.resetAt - Date.now()) / 1000)));
      return reply.code(429).send({
        code: 'API_RATE_LIMITED',
        message: 'The API token rate limit has been exceeded.',
        details: { kind, resetAt: rateLimit.resetAt },
      });
    }
    (request as ApiTokenRequest).apiTokenAuth = record;
  };
}

function requireAnyToken(database: DatabaseSync, limiter: ApiTokenRateLimiter) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const token = bearerToken(request);
    if (!token) {
      return reply.code(401).send({
        code: 'API_TOKEN_REQUIRED',
        message: 'A Bearer API token is required.',
      });
    }
    const record = resolveApiToken(database, token);
    if (!record) {
      return reply.code(401).send({
        code: 'API_TOKEN_INVALID',
        message: 'The API token is invalid, expired or revoked.',
      });
    }
    const rateLimit = limiter.consume(record.id, 'regular');
    reply
      .header('x-ratelimit-limit', rateLimit.limit)
      .header('x-ratelimit-remaining', rateLimit.remaining)
      .header('x-ratelimit-reset', Math.ceil(rateLimit.resetAt / 1000));
    if (!rateLimit.allowed) {
      reply.header('retry-after', Math.max(1, Math.ceil((rateLimit.resetAt - Date.now()) / 1000)));
      return reply.code(429).send({
        code: 'API_RATE_LIMITED',
        message: 'The API token rate limit has been exceeded.',
        details: { kind: 'regular', resetAt: rateLimit.resetAt },
      });
    }
    (request as ApiTokenRequest).apiTokenAuth = record;
  };
}
function recordApiAudit(
  database: DatabaseSync,
  request: FastifyRequest,
  action: string,
  details: Record<string, unknown>,
): void {
  const token = (request as ApiTokenRequest).apiTokenAuth;
  database.prepare(`
    INSERT INTO audit_logs (admin_id, action, details_json, remote_address, created_at)
    VALUES (NULL, ?, ?, ?, ?)
  `).run(
    action,
    JSON.stringify({ tokenId: token?.id, tokenName: token?.name, ...details }),
    request.ip,
    Date.now(),
  );
}

function ifMatch(request: FastifyRequest): string | undefined {
  const value = request.headers['if-match'];
  return Array.isArray(value) ? value[0] : value;
}

export async function registerApiV1Routes(
  app: FastifyInstance,
  dependencies: { config: AdminConfig; database: DatabaseSync; repository: ContentRepository },
): Promise<void> {
  const { config, database, repository } = dependencies;
  const imageService = new ImageService({ contentRoot: config.contentRoot });
  const rateLimiter = new ApiTokenRateLimiter();

  app.get('/api/v1/posts', {
    schema: jsonSchema({ querystring: apiV1PostListQuerySchema }),
    preHandler: requireScope(database, rateLimiter, 'posts:read'),
  }, async (request) => {
    const query = request.query as { query?: string; status?: string; page?: string };
    let posts = await repository.listPosts();
    const search = query.query?.trim().toLowerCase();
    if (search) {
      posts = posts.filter((post) => [post.slug, post.title, post.description, ...post.tags]
        .some((value) => value.toLowerCase().includes(search)));
    }
    if (query.status === 'draft') posts = posts.filter((post) => post.draft);
    if (query.status === 'published') posts = posts.filter((post) => !post.draft);
    recordApiAudit(database, request, 'api.posts.list', { resultCount: posts.length });
    return paged(posts.map(({ body: _body, ...post }) => post), Number(query.page ?? 1));
  });

  app.get('/api/v1/posts/:slug', {
    schema: jsonSchema({ params: slugParamsSchema }),
    preHandler: requireScope(database, rateLimiter, 'posts:read'),
  }, async (request) => {
    const slug = (request.params as { slug: string }).slug;
    const post = await repository.readPost(slug);
    recordApiAudit(database, request, 'api.posts.read', { slug, revision: post.revision });
    return post;
  });

  app.post('/api/v1/posts', {
    schema: jsonSchema({ body: apiV1PostCreateBodySchema }),
    preHandler: requireScope(database, rateLimiter, 'posts:write'),
  }, async (request, reply) => {
    const body = request.body as {
      slug: string;
      title: string;
      description: string;
      publishedAt: string;
      updatedAt?: string;
      tags: string[];
      cover?: string;
      body: string;
    };
    const created = await repository.createPost({
      ...body,
      draft: true,
      featured: false,
    });
    recordApiAudit(database, request, 'api.posts.create', {
      slug: created.slug,
      revision: created.revision,
    });
    return reply.code(201).send(created);
  });

  app.put('/api/v1/posts/:slug', {
    schema: jsonSchema({ params: slugParamsSchema, body: apiV1PostUpdateBodySchema }),
    preHandler: requireScope(database, rateLimiter, 'posts:write'),
  }, async (request, reply) => {
    const revision = ifMatch(request);
    if (!revision) {
      return reply.code(428).send({
        code: 'PRECONDITION_REQUIRED',
        message: 'If-Match is required for content updates.',
      });
    }
    const slug = (request.params as { slug: string }).slug;
    const current = await repository.readPost(slug);
    const body = request.body as {
      title: string;
      description: string;
      publishedAt: string;
      updatedAt?: string;
      tags: string[];
      cover?: string;
      body: string;
    };
    const updated = await repository.updatePost(slug, {
      ...body,
      slug,
      draft: current.draft,
      featured: current.featured,
    }, { expectedRevision: revision });
    recordApiAudit(database, request, 'api.posts.update', {
      slug,
      revision: updated.revision,
    });
    return updated;
  });
  app.get('/api/v1/clips', {
    schema: jsonSchema({ querystring: clipListQuerySchema }),
    preHandler: requireScope(database, rateLimiter, 'clips:read'),
  }, async (request) => {
    const query = request.query as { query?: string; language?: string; page?: string };
    let clips = await repository.listClips();
    const search = query.query?.trim().toLowerCase();
    if (search) {
      clips = clips.filter((clip) => [
        clip.slug,
        clip.title,
        clip.description ?? '',
        clip.language,
        clip.file,
      ].some((value) => value.toLowerCase().includes(search)));
    }
    if (query.language) clips = clips.filter((clip) => clip.language === query.language);
    recordApiAudit(database, request, 'api.clips.list', { resultCount: clips.length });
    return paged(clips.map(presentClip), Number(query.page ?? 1));
  });

  app.get('/api/v1/clips/:slug', {
    schema: jsonSchema({ params: slugParamsSchema }),
    preHandler: requireScope(database, rateLimiter, 'clips:read'),
  }, async (request) => {
    const slug = (request.params as { slug: string }).slug;
    const clip = presentClip(await repository.readClip(slug));
    recordApiAudit(database, request, 'api.clips.read', { slug, revision: clip.revision });
    return clip;
  });

  app.post('/api/v1/clips', {
    schema: jsonSchema({ body: apiV1ClipCreateBodySchema }),
    preHandler: requireScope(database, rateLimiter, 'clips:write'),
  }, async (request, reply) => {
    const body = request.body as Parameters<typeof createClipTransaction>[1];
    const clip = presentClip(await createClipTransaction(repository, {
      ...body,
      ownerPostSlug: undefined,
      expectedPostRevision: undefined,
      insertOffset: undefined,
    }));
    recordApiAudit(database, request, 'api.clips.create', {
      slug: clip.slug,
      revision: clip.revision,
    });
    return reply.code(201).send(clip);
  });

  app.put('/api/v1/clips/:slug', {
    schema: jsonSchema({ params: slugParamsSchema, body: apiV1ClipUpdateBodySchema }),
    preHandler: requireScope(database, rateLimiter, 'clips:write'),
  }, async (request, reply) => {
    const revision = ifMatch(request);
    if (!revision) {
      return reply.code(428).send({
        code: 'PRECONDITION_REQUIRED',
        message: 'If-Match is required for content updates.',
      });
    }
    const slug = (request.params as { slug: string }).slug;
    const current = await repository.readClip(slug);
    const body = request.body as Omit<Parameters<typeof updateClipTransaction>[2], 'expectedRevision'> & {
      slug?: string;
    };
    const clip = presentClip(await updateClipTransaction(repository, slug, {
      ...body,
      file: current.file,
      expectedRevision: revision,
    }));
    recordApiAudit(database, request, 'api.clips.update', {
      slug,
      revision: clip.revision,
    });
    return clip;
  });
  app.get('/api/v1/images', {
    schema: jsonSchema({ querystring: imageListQuerySchema }),
    preHandler: requireScope(database, rateLimiter, 'images:read'),
  }, async (request) => {
    const query = request.query as {
      query?: string;
      page?: string;
    };
    let images = await Promise.all(
      (await repository.listImages()).map((image) => presentImage(config, image)),
    );
    const search = query.query?.trim().toLowerCase();
    if (search) images = images.filter((image) => image.name.toLowerCase().includes(search));
    recordApiAudit(database, request, 'api.images.list', { resultCount: images.length });
    return paged(images, Number(query.page ?? 1));
  });

  app.post('/api/v1/images', {
    schema: jsonSchema(),
    preHandler: requireScope(database, rateLimiter, 'images:write', 'upload'),
  }, async (request, reply) => {
    const maxImageBytes = configuredUploadLimit('BLOG_MAX_IMAGE_BYTES', MAX_IMAGE_BYTES);
    const file = await request.file({ limits: { fileSize: maxImageBytes } });
    if (!file) {
      return reply.code(400).send({
        code: 'FILE_REQUIRED',
        message: 'An image file is required.',
      });
    }
    const allowedExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp']);
    const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
    if (
      !allowedExtensions.has(extname(file.filename).toLowerCase())
      || !allowedMimeTypes.has(file.mimetype.toLowerCase())
    ) {
      return reply.code(400).send({
        code: 'INVALID_IMAGE_UPLOAD',
        message: 'Only JPEG, PNG and WebP files are accepted.',
      });
    }
    const uploaded = await imageService.upload({
      originalName: file.filename,
      bytes: await file.toBuffer(),
    });
    const image = (await repository.listImages())
      .find((item) => `images/${item.path}` === uploaded.relativePath);
    if (!image) throw new Error('Uploaded image was not found in the content index.');
    const presented = await presentImage(config, image);
    recordApiAudit(database, request, 'api.images.create', {
      imageId: presented.id,
      path: presented.relativePath,
      revision: presented.sha256,
    });
    return reply.code(201).send(presented);
  });
  app.get('/api/v1/openapi.json', {
    schema: jsonSchema(),
    preHandler: requireAnyToken(database, rateLimiter),
  }, async (request) => {
    recordApiAudit(database, request, 'api.openapi.read', {});
    return createApiV1OpenApiDocument();
  });
}
