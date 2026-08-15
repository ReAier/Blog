import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import type { FastifyInstance } from 'fastify';
import type { AdminConfig } from '../config';
import { resolveContentPath } from '../content/paths';
import type { ContentRepository } from '../content/repository';
import { ImageService } from '../images/service';
import { imagePathFromId, paged, presentImage, sha256 } from '../http';
import { configuredUploadLimit, MAX_IMAGE_BYTES } from '../limits';
import { idParamsSchema, imageListQuerySchema, jsonSchema } from '../schemas';

export async function registerImageRoutes(
  app: FastifyInstance,
  dependencies: { config: AdminConfig; repository: ContentRepository },
): Promise<void> {
  const { config, repository } = dependencies;
  const imageService = new ImageService({ contentRoot: config.contentRoot });

  app.get('/api/images', { schema: jsonSchema({ querystring: imageListQuerySchema }) }, async (request) => {
    const query = request.query as { query?: string; referencedBy?: string; owner?: string; page?: string };
    let images = await Promise.all(
      (await repository.listImages()).map((image) => presentImage(config, image)),
    );
    const search = query.query?.trim().toLowerCase();
    if (search) images = images.filter((image) => image.name.toLowerCase().includes(search));
    const referencedBy = query.referencedBy ?? query.owner;
    if (referencedBy) images = images.filter((image) => image.references.some((reference) => reference.postSlug === referencedBy));
    return paged(images, Number(query.page ?? 1));
  });

  app.get('/api/images/:id/content', { schema: { params: idParamsSchema } }, async (request, reply) => {
    const path = imagePathFromId((request.params as { id: string }).id);
    const absolute = resolveContentPath(config.contentRoot, 'images', path);
    reply.type('image/webp').header('cache-control', 'private, max-age=3600');
    return reply.send(await readFile(absolute));
  });

  app.post('/api/images', { schema: jsonSchema() }, async (request, reply) => {
    const maxImageBytes = configuredUploadLimit('BLOG_MAX_IMAGE_BYTES', MAX_IMAGE_BYTES);
    const file = await request.file({ limits: { fileSize: maxImageBytes } });
    if (!file) return reply.code(400).send({ code: 'FILE_REQUIRED' });
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
    const bytes = await file.toBuffer();
    const uploaded = await imageService.upload({
      originalName: file.filename,
      bytes,
    });
    const image = (await repository.listImages())
      .find((item) => `images/${item.path}` === uploaded.relativePath);
    if (!image) throw new Error('Uploaded image was not found in the content index.');
    return reply.code(201).send(await presentImage(config, image));
  });

  app.delete('/api/images/:id', { schema: jsonSchema({ params: idParamsSchema }) }, async (request, reply) => {
    const path = imagePathFromId((request.params as { id: string }).id);
    const image = (await repository.listImages()).find((item) => item.path === path);
    if (!image) return reply.code(404).send({ code: 'CONTENT_NOT_FOUND' });
    if (image.references.length) {
      return reply.code(409).send({
        code: 'IMAGE_REFERENCED',
        message: 'The image is still referenced by content.',
        references: image.references,
      });
    }
    const source = resolveContentPath(config.contentRoot, 'images', path);
    const bytes = await readFile(source);
    const contentHash = sha256(bytes);
    const blob = resolve(config.historyRoot, contentHash);
    await writeFile(blob, bytes, { flag: 'wx', mode: 0o600 }).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'EEXIST') throw error;
    });
    const trashId = randomUUID();
    const trashBase = resolve(config.trashRoot, 'images', trashId);
    const target = resolve(trashBase, path);
    await mkdir(dirname(target), { recursive: true });
    await rename(source, target);
    await writeFile(
      resolve(trashBase, 'restore.json'),
      `${JSON.stringify({ path, sha256: contentHash, deletedAt: new Date().toISOString() })}\n`,
      'utf8',
    );
    return { ok: true, trashId };
  });

  app.post('/api/images/:id/restore', { schema: jsonSchema({ params: idParamsSchema }) }, async (request, reply) => {
    const trashId = (request.params as { id: string }).id;
    if (!/^[a-f0-9-]{36}$/i.test(trashId)) {
      return reply.code(400).send({ code: 'INVALID_TRASH_ID' });
    }
    const base = resolve(config.trashRoot, 'images', trashId);
    const metadata = JSON.parse(
      await readFile(resolve(base, 'restore.json'), 'utf8'),
    ) as { path: string };
    const source = resolve(base, metadata.path);
    const target = resolveContentPath(config.contentRoot, 'images', metadata.path);
    try {
      await readFile(target);
      return reply.code(409).send({ code: 'IMAGE_ALREADY_EXISTS' });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    await mkdir(dirname(target), { recursive: true });
    await rename(source, target);
    await rm(base, { recursive: true, force: true });
    const image = (await repository.listImages()).find((item) => item.path === metadata.path);
    return image ? presentImage(config, image) : { ok: true };
  });
}
