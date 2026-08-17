import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import type { AdminConfig } from '../config';
import { ContentConflictError, ContentValidationError } from '../content/errors';
import { parseImportedPostMarkdown, parsePostMarkdown, serializePostMarkdown } from '../content/markdown';
import { withContentOperation } from '../content/operation-log';
import { resolveContentPath } from '../content/paths';
import type { ContentRepository } from '../content/repository';
import { migratePostSlug } from '../content/slug-migration';
import { writeTextFileAtomic } from '../content/storage';
import { HistoryService } from '../history/service';
import {
  adminAuth,
  expectedRevision,
  paged,
  postFromEditorInput,
  type EditorPostInput,
} from '../http';
import { configuredUploadLimit, MAX_MARKDOWN_BYTES } from '../limits';
import {
  editorPostBodySchema,
  jsonSchema,
  postHistoryParamsSchema,
  postListQuerySchema,
  postSlugMigrationBodySchema,
  slugParamsSchema,
} from '../schemas';

function shanghaiDate(): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
export interface ContentRouteDependencies {
  config: AdminConfig;
  database: DatabaseSync;
  repository: ContentRepository;
  history: HistoryService;
}

export async function registerPostRoutes(
  app: FastifyInstance,
  dependencies: ContentRouteDependencies,
): Promise<void> {
  const { config, repository, history } = dependencies;
  const markdownLimit = () => configuredUploadLimit('BLOG_MAX_MARKDOWN_BYTES', MAX_MARKDOWN_BYTES);

  const headerValue = (request: FastifyRequest, name: string) => {
    const value = request.headers[name];
    return Array.isArray(value) ? value[0] : value;
  };
  const recordHistory = async (
    post: ReturnType<typeof postFromEditorInput>,
    request: FastifyRequest,
    groupPrefix: string,
  ) => history.record({
    contentPath: `blog/${post.slug}.md`,
    content: serializePostMarkdown(post),
    groupId: headerValue(request, 'x-history-group') || `${groupPrefix}-${Date.now()}`,
    adminId: adminAuth(request).sessionId ? adminAuth(request).adminId : undefined,
  });
  const recordManualEditorHistory = async (
    post: ReturnType<typeof postFromEditorInput>,
    request: FastifyRequest,
  ) => {
    if (headerValue(request, 'x-history-mode') !== 'manual') return;
    await recordHistory(post, request, 'manual');
  };

  app.get('/api/posts', { schema: jsonSchema({ querystring: postListQuerySchema }) }, async (request) => {
    const query = request.query as {
      query?: string;
      status?: string;
      tags?: string;
      page?: string;
      includeDeleted?: string;
    };
    const allPosts = await repository.listPosts({ includeDeleted: true });
    const counts = {
      all: allPosts.filter((post) => !post.deleted).length,
      published: allPosts.filter((post) => !post.deleted && !post.draft).length,
      drafts: allPosts.filter((post) => !post.deleted && post.draft).length,
      deleted: allPosts.filter((post) => post.deleted).length,
    };
    let posts = query.includeDeleted === 'true'
      ? allPosts
      : allPosts.filter((post) => !post.deleted);
    const search = query.query?.trim().toLowerCase();
    if (search) {
      posts = posts.filter((post) => post.title.toLowerCase().includes(search));
    }
    const tags = query.tags?.split(',').map((tag) => tag.trim()).filter(Boolean) ?? [];
    if (tags.length) posts = posts.filter((post) => post.tags.some((tag) => tags.includes(tag)));
    if (query.status === 'draft') posts = posts.filter((post) => post.draft && !post.deleted);
    if (query.status === 'published') posts = posts.filter((post) => !post.draft && !post.deleted);
    return { ...paged(posts.map(({ body: _body, ...post }) => post), Number(query.page ?? 1)), counts };
  });

  app.post('/api/posts', { schema: jsonSchema({ body: editorPostBodySchema }) }, async (request, reply) => {
    const created = await repository.createPost(postFromEditorInput(request.body as EditorPostInput));
    await recordManualEditorHistory(created, request);
    return reply.code(201).send(created);
  });

  app.get('/api/posts/:slug', { schema: jsonSchema({ params: slugParamsSchema }) }, async (request) => (
    repository.readPost((request.params as { slug: string }).slug)
  ));

  const update = async (request: FastifyRequest) => {
    const slug = (request.params as { slug: string }).slug;
    const body = request.body as EditorPostInput;
    const revision = expectedRevision(request, body as unknown as Record<string, unknown>);
    if (!revision) throw new ContentValidationError('expectedRevision or If-Match is required.');
    const updated = await repository.updatePost(
      slug,
      postFromEditorInput(body, slug),
      { expectedRevision: revision },
    );
    await recordManualEditorHistory(updated, request);
    return updated;
  };
  app.put('/api/posts/:slug', {
    schema: jsonSchema({ params: slugParamsSchema, body: editorPostBodySchema }),
  }, update);
  app.patch('/api/posts/:slug', {
    schema: jsonSchema({ params: slugParamsSchema, body: editorPostBodySchema }),
  }, update);

  app.delete('/api/posts/:slug', {
    schema: jsonSchema({ params: slugParamsSchema }),
  }, async (request) => {
    const slug = (request.params as { slug: string }).slug;
    const revision = expectedRevision(request, (request.body ?? {}) as Record<string, unknown>);
    if (!revision) throw new ContentValidationError('expectedRevision or If-Match is required.');
    const deleted = await repository.softDeletePost(slug, { expectedRevision: revision });
    await recordHistory(deleted, request, 'delete');
    return deleted;
  });

  app.post('/api/posts/:slug/restore', {
    schema: jsonSchema({ params: slugParamsSchema }),
  }, async (request) => {
    const slug = (request.params as { slug: string }).slug;
    const revision = expectedRevision(request, (request.body ?? {}) as Record<string, unknown>);
    if (!revision) throw new ContentValidationError('expectedRevision or If-Match is required.');
    const restored = await repository.restorePost(slug, { expectedRevision: revision });
    await recordHistory(restored, request, 'restore');
    return restored;
  });

  app.get('/api/posts/:slug/download', { schema: { params: slugParamsSchema } }, async (request, reply) => {
    const post = await repository.readPost((request.params as { slug: string }).slug);
    reply.type('text/markdown; charset=utf-8')
      .header('content-disposition', `attachment; filename="${post.fileName}"`);
    return serializePostMarkdown(post);
  });

  app.post('/api/posts/import', { schema: jsonSchema() }, async (request, reply) => {
    const limit = markdownLimit();
    const file = await request.file({ limits: { fileSize: limit } });
    if (!file) return reply.code(400).send({ code: 'FILE_REQUIRED' });
    const bytes = await file.toBuffer();
    const validMime = ['text/markdown', 'text/plain', 'application/octet-stream']
      .includes(file.mimetype.toLowerCase());
    if (
      bytes.byteLength > limit
      || !file.filename.toLowerCase().endsWith('.md')
      || !validMime
    ) {
      return reply.code(bytes.byteLength > limit ? 413 : 400).send({
        code: 'INVALID_MARKDOWN_UPLOAD',
      });
    }
    const imported = parseImportedPostMarkdown(bytes.toString('utf8'), file.filename, shanghaiDate());
    const created = await repository.createPost(imported);
    await recordHistory(created, request, 'import');
    return reply.code(201).send(created);
  });

  app.get('/api/posts/:slug/history', {
    schema: jsonSchema({ params: slugParamsSchema, response: 'array' }),
  }, async (request) => {
    const slug = (request.params as { slug: string }).slug;
    return history.list(`blog/${slug}.md`);
  });

  app.get('/api/posts/:slug/history/:revisionNumber', {
    schema: jsonSchema({ params: postHistoryParamsSchema }),
  }, async (request, reply) => {
    const { slug, revisionNumber } = request.params as { slug: string; revisionNumber: string };
    const entry = (history.list(`blog/${slug}.md`) as Array<{
      revisionNumber: number;
      blobSha256: string;
    }>).find((item) => item.revisionNumber === Number(revisionNumber));
    if (!entry) return reply.code(404).send({ code: 'REVISION_NOT_FOUND' });
    const content = await history.readBlob(entry.blobSha256);
    return { ...entry, content, body: parsePostMarkdown(content, slug).body };
  });

  app.post('/api/posts/:slug/history/:revisionNumber/restore', {
    schema: jsonSchema({ params: postHistoryParamsSchema }),
  }, async (request) => {
    const { slug, revisionNumber } = request.params as { slug: string; revisionNumber: string };
    const body = request.body as { expectedRevision?: string };
    const current = await repository.readPost(slug);
    const expected = expectedRevision(request, body as unknown as Record<string, unknown>);
    if (!expected || expected !== current.revision) {
      throw new ContentConflictError('Post revision changed before history restore.', {
        actualRevision: current.revision,
      });
    }
    await history.restore({
      contentPath: `blog/${slug}.md`,
      revisionNumber: Number(revisionNumber),
      adminId: adminAuth(request).sessionId ? adminAuth(request).adminId : undefined,
      write: async (content) => writeTextFileAtomic(
        resolveContentPath(config.contentRoot, 'blog', `${slug}.md`),
        content,
        { expectedRevision: current.revision },
      ),
    });
    return repository.readPost(slug);
  });

  app.post('/api/posts/:slug/migrate-slug', {
    schema: jsonSchema({ params: slugParamsSchema, body: postSlugMigrationBodySchema }),
  }, async (request, reply) => {
    const oldSlug = (request.params as { slug: string }).slug;
    const body = request.body as { newSlug?: string; expectedRevision?: string };
    const revision = expectedRevision(request, body as unknown as Record<string, unknown>);
    if (!body.newSlug || !revision) {
      return reply.code(400).send({ code: 'INVALID_SLUG_MIGRATION' });
    }
    const migrated = await withContentOperation({
      contentRoot: config.contentRoot,
      operationsRoot: `${config.jobsRoot}/operations`,
      type: 'post-slug-migration',
      execute: () => migratePostSlug({
        repository,
        oldSlug,
        newSlug: body.newSlug!,
        expectedRevision: revision,
      }),
    });
    await recordHistory(migrated, request, 'slug-migration');
    return reply.code(201).send(migrated);
  });
}
