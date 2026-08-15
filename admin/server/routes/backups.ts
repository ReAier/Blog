import { randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readdir, rm, stat } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { FastifyInstance } from 'fastify';
import type { AdminConfig } from '../config';
import { backupApplyBodySchema, idParamsSchema, jsonSchema } from '../schemas';
import { validateContentRoot } from '../publish/runner';
import {
  applyBackup,
  createBackup,
  validateBackup,
  type BackupCandidate,
} from '../backups/service';

export async function registerBackupRoutes(
  app: FastifyInstance,
  config: AdminConfig,
): Promise<void> {
  const candidates = new Map<string, BackupCandidate>();
  const backupRoot = resolve(config.jobsRoot, 'backups');
  const validationRoot = resolve(config.jobsRoot, 'restore-validation');
  const validateCandidateContent = async (candidate: BackupCandidate, id: string) => {
    const outputPath = resolve(validationRoot, `${id}.conf`);
    await mkdir(validationRoot, { recursive: true });
    try {
      await validateContentRoot({ contentRoot: candidate.stagingPath, outputPath });
    } finally {
      await rm(outputPath, { force: true });
    }
  };

  const list = async () => {
    let names: string[] = [];
    try {
      names = (await readdir(backupRoot)).filter((name) => name.toLowerCase().endsWith('.zip'));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    return Promise.all(names.sort().reverse().map(async (name) => {
      const path = resolve(backupRoot, name);
      const info = await stat(path);
      return {
        id: basename(name, '.zip'),
        name,
        createdAt: info.birthtime.toISOString(),
        byteSize: info.size,
        fileCount: 0,
        downloadUrl: `/api/backups/${encodeURIComponent(basename(name, '.zip'))}/download`,
      };
    }));
  };

  app.get('/api/backups', { schema: jsonSchema({ response: 'array' }) }, list);
  app.post('/api/backups', { schema: jsonSchema() }, async (_request, reply) => {
    const id = `aier-content-${new Date().toISOString().replace(/[:.]/g, '-')}`;
    const path = resolve(backupRoot, `${id}.zip`);
    const result = await createBackup({ contentRoot: config.contentRoot, outputPath: path });
    const info = await stat(path);
    return reply.code(201).send({
      id,
      name: `${id}.zip`,
      createdAt: info.birthtime.toISOString(),
      byteSize: info.size,
      fileCount: result.fileCount,
      downloadUrl: `/api/backups/${encodeURIComponent(id)}/download`,
    });
  });
  app.get('/api/backups/:id/download', { schema: { params: idParamsSchema } }, async (request, reply) => {
    const id = (request.params as { id: string }).id;
    if (!/^[A-Za-z0-9._-]+$/.test(id)) {
      return reply.code(400).send({ code: 'INVALID_BACKUP_ID' });
    }
    const path = resolve(backupRoot, `${id}.zip`);
    reply.type('application/zip')
      .header('content-disposition', `attachment; filename="${id}.zip"`);
    return reply.send(createReadStream(path));
  });
  app.get('/api/backups/export', async (_request, reply) => {
    const path = resolve(
      backupRoot,
      `aier-content-${new Date().toISOString().replace(/[:.]/g, '-')}.zip`,
    );
    await createBackup({ contentRoot: config.contentRoot, outputPath: path });
    reply.type('application/zip')
      .header('content-disposition', `attachment; filename="${basename(path)}"`);
    return reply.send(createReadStream(path));
  });
  app.post('/api/backups/validate', { schema: jsonSchema() }, async (request, reply) => {
    const file = await request.file({ limits: { fileSize: 256 * 1024 * 1024 } });
    if (!file) return reply.code(400).send({ code: 'FILE_REQUIRED' });
    const id = randomUUID();
    const archivePath = resolve(config.jobsRoot, 'uploads', `${id}.zip`);
    await mkdir(dirname(archivePath), { recursive: true });
    let candidate: BackupCandidate | undefined;
    try {
      await pipeline(file.file, createWriteStream(archivePath, { mode: 0o600, flags: 'wx' }));
      candidate = await validateBackup({
        archivePath,
        stagingRoot: resolve(config.jobsRoot, 'restore-candidates'),
      });
      await validateCandidateContent(candidate, id);
      candidates.set(id, candidate);
      return { id, manifest: candidate.manifest };
    } catch (error) {
      if (candidate) await rm(candidate.stagingPath, { recursive: true, force: true });
      throw error;
    } finally {
      await rm(archivePath, { force: true });
    }
  });
  app.post('/api/backups/apply', {
    schema: jsonSchema({ body: backupApplyBodySchema }),
  }, async (request, reply) => {
    const id = (request.body as { id?: string }).id;
    const candidate = id ? candidates.get(id) : undefined;
    if (!candidate) return reply.code(404).send({ code: 'BACKUP_CANDIDATE_NOT_FOUND' });
    try {
      await validateCandidateContent(candidate, id!);
      return await applyBackup({
        candidate,
        contentRoot: config.contentRoot,
        snapshotRoot: resolve(config.jobsRoot, 'restore-snapshots'),
      });
    } finally {
      candidates.delete(id!);
      await rm(candidate.stagingPath, { recursive: true, force: true });
    }
  });
  app.post('/api/backups/:id/validate', {
    schema: jsonSchema({ params: idParamsSchema }),
  }, async (request, reply) => {
    const backupId = (request.params as { id: string }).id;
    if (!/^[A-Za-z0-9._-]+$/.test(backupId)) {
      return reply.code(400).send({ code: 'INVALID_BACKUP_ID' });
    }
    const candidateId = randomUUID();
    let candidate: BackupCandidate | undefined;
    try {
      candidate = await validateBackup({
        archivePath: resolve(backupRoot, `${backupId}.zip`),
        stagingRoot: resolve(config.jobsRoot, 'restore-candidates'),
      });
      await validateCandidateContent(candidate, candidateId);
      candidates.set(candidateId, candidate);
      return { id: candidateId, manifest: candidate.manifest };
    } catch (error) {
      if (candidate) await rm(candidate.stagingPath, { recursive: true, force: true });
      throw error;
    }
  });
}
