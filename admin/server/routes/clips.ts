import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ContentRepository } from '../content/repository';
import { migrateClipSlug } from '../content/slug-migration';
import { ContentValidationError } from '../content/errors';
import { withContentOperation } from '../content/operation-log';
import {
  attachClipToPostTransaction,
  createClipTransaction,
  removeClipFromPostTransaction,
  updateClipTransaction,
} from '../content/transactions';
import type { HistoryService } from '../history/service';
import type { AdminConfig } from '../config';
import { moveClipToTrash } from '../trash/service';
import {
  adminAuth,
  expectedRevision,
  paged,
  presentClip,
} from '../http';
import { configuredUploadLimit, MAX_CLIP_BYTES } from '../limits';
import {
  attachClipBodySchema,
  clipListQuerySchema,
  clipSlugMigrationBodySchema,
  editorClipBodySchema,
  jsonSchema,
  postClipParamsSchema,
  postParamsSchema,
  removeClipBodySchema,
  slugParamsSchema,
} from '../schemas';

export async function registerClipRoutes(
  app: FastifyInstance,
  dependencies: {
    config: AdminConfig;
    repository: ContentRepository;
    history: HistoryService;
  },
): Promise<void> {
  const { config, repository, history } = dependencies;
  const clipLimit = () => configuredUploadLimit('BLOG_MAX_CLIP_BYTES', MAX_CLIP_BYTES);

  app.get('/api/clips', { schema: jsonSchema({ querystring: clipListQuerySchema }) }, async (request) => {
    const query = request.query as { query?: string; language?: string; page?: string };
    const allClips = await repository.listClips();
    const languages = Array.from(new Set(allClips.map((clip) => clip.language))).sort();
    let clips = allClips;
    const search = query.query?.trim().toLowerCase();
    if (search) {
      clips = clips.filter((clip) => clip.file.toLowerCase().includes(search));
    }
    if (query.language) clips = clips.filter((clip) => clip.language === query.language);
    return { ...paged(clips.map(presentClip), Number(query.page ?? 1)), languages };
  });

  app.post('/api/clips', { schema: jsonSchema({ body: editorClipBodySchema }) }, async (request, reply) => {
    const input = request.body as Parameters<typeof createClipTransaction>[1];
    const clip = await withContentOperation({
      contentRoot: config.contentRoot,
      operationsRoot: `${config.jobsRoot}/operations`,
      type: 'clip-create',
      execute: () => createClipTransaction(
        repository,
        input,
      ),
    });
    await history.record({
      contentPath: `clips/${clip.slug}/${clip.file}`,
      content: clip.code,
      groupId: `clip-create-${randomUUID()}`,
      adminId: adminAuth(request).sessionId ? adminAuth(request).adminId : undefined,
    });
    return reply.code(201).send(presentClip(clip));
  });

  app.get('/api/clips/:slug', { schema: jsonSchema({ params: slugParamsSchema }) }, async (request) => (
    presentClip(await repository.readClip((request.params as { slug: string }).slug))
  ));

  const update = async (request: FastifyRequest) => {
    const slug = (request.params as { slug: string }).slug;
    const body = request.body as Parameters<typeof updateClipTransaction>[2] & {
      expectedRevision?: string;
    };
    const revision = expectedRevision(request, body as unknown as Record<string, unknown>);
    if (!revision) throw new ContentValidationError('expectedRevision or If-Match is required.');
    const clip = await withContentOperation({
      contentRoot: config.contentRoot,
      operationsRoot: `${config.jobsRoot}/operations`,
      type: 'clip-update',
      execute: () => updateClipTransaction(repository, slug, {
        ...body,
        expectedRevision: revision,
      }),
    });
    await history.record({
      contentPath: `clips/${clip.slug}/${clip.file}`,
      content: clip.code,
      groupId: `clip-save-${randomUUID()}`,
      adminId: adminAuth(request).sessionId ? adminAuth(request).adminId : undefined,
    });
    return presentClip(clip);
  };
  app.put('/api/clips/:slug', {
    schema: jsonSchema({ params: slugParamsSchema, body: editorClipBodySchema }),
  }, update);
  app.patch('/api/clips/:slug', {
    schema: jsonSchema({ params: slugParamsSchema, body: editorClipBodySchema }),
  }, update);

  app.delete('/api/clips/:slug', { schema: jsonSchema({ params: slugParamsSchema }) }, async (request) => {
    const slug = (request.params as { slug: string }).slug;
    const trashId = await moveClipToTrash({
      contentRoot: config.contentRoot,
      trashRoot: config.trashRoot,
      repository,
      slug,
    });
    return { ok: true, trashId };
  });

  app.post('/api/posts/:postSlug/clip-references', {
    schema: jsonSchema({ params: postParamsSchema, body: attachClipBodySchema }),
  }, async (request) => {
    const { postSlug } = request.params as { postSlug: string };
    const body = request.body as {
      clipSlug?: string;
      expectedPostRevision?: string;
      insertOffset?: number;
    };
    if (!body.clipSlug || !body.expectedPostRevision) {
      throw new ContentValidationError('clipSlug and expectedPostRevision are required.');
    }
    return attachClipToPostTransaction(repository, postSlug, body.clipSlug, {
      expectedPostRevision: body.expectedPostRevision,
      insertOffset: body.insertOffset,
    });
  });

  app.delete('/api/posts/:postSlug/clip-references/:clipSlug', {
    schema: jsonSchema({ params: postClipParamsSchema, body: removeClipBodySchema }),
  }, async (request) => {
    const { postSlug, clipSlug } = request.params as { postSlug: string; clipSlug: string };
    const body = request.body as { expectedPostRevision?: string };
    if (!body.expectedPostRevision) {
      throw new ContentValidationError('expectedPostRevision is required.');
    }
    await removeClipFromPostTransaction(repository, postSlug, clipSlug, {
      expectedPostRevision: body.expectedPostRevision,
    });
    return { ok: true };
  });

  app.post('/api/posts/:postSlug/clips/:clipSlug/remove', {
    schema: jsonSchema({ params: postClipParamsSchema, body: removeClipBodySchema }),
  }, async (request) => {
    const { postSlug, clipSlug } = request.params as { postSlug: string; clipSlug: string };
    const body = request.body as { expectedPostRevision?: string; trashSource?: boolean };
    if (!body.expectedPostRevision) {
      throw new ContentValidationError('expectedPostRevision is required.');
    }
    await withContentOperation({
      contentRoot: config.contentRoot,
      operationsRoot: `${config.jobsRoot}/operations`,
      type: 'clip-remove',
      execute: () => removeClipFromPostTransaction(repository, postSlug, clipSlug, {
        expectedPostRevision: body.expectedPostRevision!,
        trashRoot: config.trashRoot,
        trashSource: body.trashSource !== false,
      }),
    });
    return { ok: true };
  });


  app.post('/api/clips/:slug/migrate-slug', {
    schema: jsonSchema({ params: slugParamsSchema, body: clipSlugMigrationBodySchema }),
  }, async (request, reply) => {
    const oldSlug = (request.params as { slug: string }).slug;
    const body = request.body as { newFile?: string; expectedRevision?: string };
    const revision = expectedRevision(request, body as unknown as Record<string, unknown>);
    if (!body.newFile || !revision) {
      return reply.code(400).send({ code: 'INVALID_SLUG_MIGRATION' });
    }
    const migrated = await withContentOperation({
      contentRoot: config.contentRoot,
      operationsRoot: `${config.jobsRoot}/operations`,
      type: 'clip-slug-migration',
      execute: () => migrateClipSlug({
        repository,
        oldSlug,
        newFile: body.newFile!,
        expectedRevision: revision,
      }),
    });
    await history.record({
      contentPath: `clips/${migrated.slug}/${migrated.file}`,
      content: migrated.code,
      groupId: `clip-slug-migration-${randomUUID()}`,
      adminId: adminAuth(request).sessionId ? adminAuth(request).adminId : undefined,
    });
    return reply.code(201).send(presentClip(migrated));
  });

  app.get('/api/clips/:slug/download', { schema: { params: slugParamsSchema } }, async (request, reply) => {
    const clip = await repository.readClip((request.params as { slug: string }).slug);
    reply.type('text/plain; charset=utf-8')
      .header('content-disposition', `attachment; filename="${clip.file}"`);
    return clip.code;
  });

  app.post('/api/clips/import', { schema: jsonSchema() }, async (request, reply) => {
    const limit = clipLimit();
    const file = await request.file({ limits: { fileSize: limit } });
    if (!file) return reply.code(400).send({ code: 'FILE_REQUIRED' });
    const bytes = await file.toBuffer();
    const validMime = file.mimetype.startsWith('text/')
      || ['application/javascript', 'application/json', 'application/xml', 'application/octet-stream']
        .includes(file.mimetype.toLowerCase());
    if (bytes.byteLength > limit || !validMime) {
      return reply.code(bytes.byteLength > limit ? 413 : 400).send({ code: 'INVALID_CLIP_UPLOAD' });
    }
    const field = (name: string): string => {
      const value = file.fields[name];
      const item = Array.isArray(value) ? value.find((part) => part.type === 'field') : value;
      return item?.type === 'field' ? String(item.value) : '';
    };
    const ownerPostSlug = field('ownerPostSlug') || undefined;
    const expectedPostRevision = field('expectedPostRevision') || undefined;
    const title = field('title') || file.filename;
    const language = field('language') || 'text';
    const createdAt = field('createdAt');
    if (!createdAt) {
      return reply.code(400).send({ code: 'CLIP_IMPORT_METADATA_REQUIRED' });
    }
    const slug = (await import('../content/clips')).deriveClipSlug(file.filename);
    const clip = await withContentOperation({
      contentRoot: config.contentRoot,
      operationsRoot: `${config.jobsRoot}/operations`,
      type: 'clip-import',
      execute: () => createClipTransaction(repository, {
        slug,
        ownerPostSlug,
        expectedPostRevision,
        title,
        description: field('description') || undefined,
        language,
        file: file.filename,
        createdAt,
        code: bytes.toString('utf8'),
      }),
    });
    await history.record({
      contentPath: `clips/${clip.slug}/${clip.file}`,
      content: clip.code,
      groupId: `clip-import-${randomUUID()}`,
      adminId: adminAuth(request).sessionId ? adminAuth(request).adminId : undefined,
    });
    return reply.code(201).send(presentClip(clip));
  });
}
