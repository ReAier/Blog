import type { FastifyInstance } from 'fastify';
import type { AdminConfig } from '../config';
import type { ContentRepository } from '../content/repository';
import { deleteTrashItem, listTrash, restoreTrashItem, type TrashItemType } from '../trash/service';
import { jsonSchema } from '../schemas';

const trashTypes = new Set<TrashItemType>(['post', 'clip', 'image']);

export async function registerTrashRoutes(
  app: FastifyInstance,
  dependencies: { config: AdminConfig; repository: ContentRepository },
): Promise<void> {
  const { config, repository } = dependencies;
  app.get('/api/trash', async () => ({
    items: await listTrash({
      contentRoot: config.contentRoot,
      trashRoot: config.trashRoot,
      repository,
    }),
  }));

  app.post('/api/trash/:type/:id/restore', { schema: jsonSchema() }, async (request, reply) => {
    const { type, id } = request.params as { type: TrashItemType; id: string };
    if (!trashTypes.has(type)) return reply.code(400).send({ code: 'INVALID_TRASH_TYPE' });
    try {
      await restoreTrashItem({
        contentRoot: config.contentRoot,
        trashRoot: config.trashRoot,
        repository,
        type,
        id,
      });
      return { ok: true };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
        return reply.code(409).send({ code: 'CONTENT_ALREADY_EXISTS' });
      }
      throw error;
    }
  });

  app.delete('/api/trash/:type/:id', { schema: jsonSchema() }, async (request, reply) => {
    const { type, id } = request.params as { type: TrashItemType; id: string };
    if (!trashTypes.has(type)) return reply.code(400).send({ code: 'INVALID_TRASH_TYPE' });
    try {
      await deleteTrashItem({
        contentRoot: config.contentRoot,
        trashRoot: config.trashRoot,
        repository,
        type,
        id,
      });
      return { ok: true };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return reply.code(404).send({ code: 'CONTENT_NOT_FOUND' });
      }
      throw error;
    }
  });

}
