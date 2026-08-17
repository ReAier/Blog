import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import type { FastifyInstance } from 'fastify';
import type { AdminConfig } from '../config';
import { resolveContentPath } from '../content/paths';
import type { ContentRepository } from '../content/repository';
import { ImageService } from '../images/service';
import { imagePathFromId, paged, presentImage, sha256 } from '../http';
import { moveImageToTrash, restoreTrashItem } from '../trash/service';
import { configuredUploadLimit, MAX_IMAGE_BYTES } from '../limits';
import { idParamsSchema, imageListQuerySchema, jsonSchema } from '../schemas';

export async function registerImageRoutes(
  app: FastifyInstance,
  dependencies: { config: AdminConfig; repository: ContentRepository },
): Promise<void> {
  const { config, repository } = dependencies;
  const imageService = new ImageService({ contentRoot: config.contentRoot });

  app.get('/media/*', async (request, reply) => {
    const path = (request.params as { '*': string })['*'];
    const absolute = resolveContentPath(config.contentRoot, 'images', path);
    const contentTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
    };
    reply.type(contentTypes[extname(path).toLowerCase()] ?? 'application/octet-stream');
    reply.header('access-control-allow-origin', '*');
    reply.header('cross-origin-resource-policy', 'cross-origin');
    reply.header('cache-control', 'private, max-age=3600');
    return reply.send(await readFile(absolute));
  });

  app.get('/api/images', { schema: jsonSchema({ querystring: imageListQuerySchema }) }, async (request) => {
    const query = request.query as { query?: string; page?: string };
    let images = await Promise.all(
      (await repository.listImages()).map((image) => presentImage(config, image)),
    );
    const search = query.query?.trim().toLowerCase();
    if (search) images = images.filter((image) => image.name.toLowerCase().includes(search));
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
    const bytes = await readFile(resolveContentPath(config.contentRoot, 'images', path));
    const trashId = await moveImageToTrash({
      contentRoot: config.contentRoot,
      trashRoot: config.trashRoot,
      historyRoot: config.historyRoot,
      path,
      sha256: sha256(bytes),
      bytes,
    });
    return { ok: true, trashId };
  });

  app.post('/api/images/:id/restore', { schema: jsonSchema({ params: idParamsSchema }) }, async (request) => {
    await restoreTrashItem({
      contentRoot: config.contentRoot,
      trashRoot: config.trashRoot,
      repository,
      type: 'image',
      id: (request.params as { id: string }).id,
    });
    return { ok: true };
  });

}
