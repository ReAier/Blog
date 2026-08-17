import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import type { FastifyInstance } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import type { AdminConfig } from '../config';
import { paged } from '../http';
import { jobIdParamsSchema, jsonSchema, logListQuerySchema } from '../schemas';
import { PublishCoordinator, type PublishJob } from '../publish/coordinator';
import {
  BuildGate,
  cleanupSnapshot,
  installRelease,
  runSiteVerification,
  validateContentSnapshot,
} from '../publish/runner';
import { createBuildSnapshot } from '../publish/snapshot';

const terminalStatuses = new Set(['succeeded', 'failed']);

function presentJob(job: PublishJob) {
  return {
    id: job.id,
    status: job.status,
    startedAt: job.startedAt ?? job.createdAt,
    finishedAt: job.finishedAt,
    contentHash: job.contentHash,
    release: job.releaseId,
    releaseId: job.releaseId,
    log: job.log.split('\n').filter(Boolean),
  };
}

interface StoredPublishJob {
  id: string;
  status: PublishJob['status'];
  content_hash: string;
  release_id: string | null;
  log: string;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

function storedJob(row: StoredPublishJob): PublishJob {
  return {
    id: row.id,
    status: row.status,
    contentHash: row.content_hash,
    releaseId: row.release_id ?? undefined,
    log: row.log,
    createdAt: row.created_at,
    startedAt: row.started_at ?? undefined,
    finishedAt: row.finished_at ?? undefined,
  };
}

export async function registerPublishRoutes(
  app: FastifyInstance,
  dependencies: {
    config: AdminConfig;
    database: DatabaseSync;
    buildGate: BuildGate;
  },
): Promise<{ coordinator: PublishCoordinator; listJobs: () => PublishJob[] }> {
  const { config, database, buildGate } = dependencies;
  database.exec(`
    CREATE TABLE IF NOT EXISTS publish_job_state (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      release_id TEXT,
      log TEXT NOT NULL,
      created_at TEXT NOT NULL,
      started_at TEXT,
      finished_at TEXT
    ) STRICT;
  `);

  const interruptedMessage = 'Publish interrupted because the admin service restarted.';
  const interruptedAt = new Date().toISOString();
  database.prepare(`
    UPDATE publish_job_state
    SET status = 'failed',
        log = CASE
          WHEN log = '' THEN ? || char(10)
          WHEN substr(log, -1) = char(10) THEN log || ? || char(10)
          ELSE log || char(10) || ? || char(10)
        END,
        finished_at = ?
    WHERE status IN ('preparing', 'queued', 'validating', 'building', 'switching')
  `).run(interruptedMessage, interruptedMessage, interruptedMessage, interruptedAt);

  const coordinator = new PublishCoordinator({
    snapshot: async () => createBuildSnapshot({
      projectRoot: config.projectRoot,
      contentRoot: config.contentRoot,
      jobsRoot: resolve(config.jobsRoot, 'publish'),
      id: randomUUID(),
    }),
    validate: async (snapshot) => validateContentSnapshot(snapshot),
    build: async (snapshot, context) => buildGate.run(async () => {
      await runSiteVerification(snapshot, context);
    }),
    switchRelease: async (snapshot, _build, context) => installRelease({
      snapshot,
      dataRoot: config.dataRoot,
      helper: process.env.BLOG_PUBLISH_HELPER,
      context,
    }),
    cleanup: async (snapshot) => cleanupSnapshot(snapshot),
  });

  const persist = (job: PublishJob) => {
    database.prepare(`
      INSERT INTO publish_job_state (
        id, status, content_hash, release_id, log,
        created_at, started_at, finished_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        status = excluded.status,
        release_id = excluded.release_id,
        log = excluded.log,
        started_at = excluded.started_at,
        finished_at = excluded.finished_at
    `).run(
      job.id,
      job.status,
      job.contentHash,
      job.releaseId ?? null,
      job.log,
      job.createdAt,
      job.startedAt ?? null,
      job.finishedAt ?? null,
    );
  };

  const fromDatabase = (id: string): PublishJob | undefined => {
    const row = database.prepare(`
      SELECT id, status, content_hash, release_id, log,
             created_at, started_at, finished_at
      FROM publish_job_state WHERE id = ?
    `).get(id) as StoredPublishJob | undefined;
    return row ? storedJob(row) : undefined;
  };

  const list = (): PublishJob[] => {
    const memory = new Map(coordinator.list().map((job) => [job.id, job]));
    const rows = database.prepare(`
      SELECT id, status, content_hash, release_id, log,
             created_at, started_at, finished_at
      FROM publish_job_state ORDER BY created_at DESC LIMIT 100
    `).all() as unknown as StoredPublishJob[];
    for (const row of rows) if (!memory.has(row.id)) memory.set(row.id, storedJob(row));
    return [...memory.values()].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  };

  app.post('/api/publish', { schema: jsonSchema() }, async (_request, reply) => {
    const job = await coordinator.publish();
    persist(job);
    let unsubscribe: () => void = () => undefined;
    unsubscribe = coordinator.subscribe(job.id, (next) => {
      persist(next);
      if (terminalStatuses.has(next.status)) unsubscribe();
    });
    return reply.code(202).send(presentJob(job));
  });
  app.get('/api/publish/jobs', { schema: jsonSchema({ response: 'array' }) }, async () => list().map(presentJob));
  app.get('/api/publish/jobs/:jobId', {
    schema: jsonSchema({ params: jobIdParamsSchema }),
  }, async (request, reply) => {
    const id = (request.params as { jobId: string }).jobId;
    const job = coordinator.get(id) ?? fromDatabase(id);
    return job ? presentJob(job) : reply.code(404).send({ code: 'JOB_NOT_FOUND' });
  });
  app.get('/api/publish/:jobId', {
    schema: jsonSchema({ params: jobIdParamsSchema }),
  }, async (request, reply) => {
    const id = (request.params as { jobId: string }).jobId;
    const job = coordinator.get(id) ?? fromDatabase(id);
    return job ? presentJob(job) : reply.code(404).send({ code: 'JOB_NOT_FOUND' });
  });
  app.get('/api/publish/:jobId/events', { schema: { params: jobIdParamsSchema } }, async (request, reply) => {
    const id = (request.params as { jobId: string }).jobId;
    const current = coordinator.get(id) ?? fromDatabase(id);
    if (!current) return reply.code(404).send({ code: 'JOB_NOT_FOUND' });
    reply.hijack();
    reply.raw.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    });
    if (!coordinator.get(id)) {
      reply.raw.end(`event: publish\ndata: ${JSON.stringify(presentJob(current))}\n\n`);
      return;
    }
    let closed = false;
    let unsubscribe: (() => void) | undefined;
    let unsubscribePending = false;
    const dispose = () => {
      if (closed) return;
      closed = true;
      if (unsubscribe) unsubscribe();
      else unsubscribePending = true;
    };
    const finish = () => {
      dispose();
      if (!reply.raw.writableEnded && !reply.raw.destroyed) reply.raw.end();
    };
    reply.raw.once('error', dispose);
    request.raw.once('close', dispose);
    unsubscribe = coordinator.subscribe(id, (job) => {
      if (closed || reply.raw.writableEnded || reply.raw.destroyed) {
        dispose();
        return;
      }
      reply.raw.write(`event: publish\ndata: ${JSON.stringify(presentJob(job))}\n\n`);
      if (terminalStatuses.has(job.status)) finish();
    });
    if (unsubscribePending) unsubscribe();
  });

  app.get('/api/logs', { schema: jsonSchema({ querystring: logListQuerySchema }) }, async (request) => {
    const query = request.query as { level?: string; scope?: string; page?: string };
    const auditRows = database.prepare(`
      SELECT id, created_at AS timestamp, action AS scope, details_json AS message
      FROM audit_logs ORDER BY created_at DESC LIMIT 500
    `).all() as Array<{
      id: number;
      timestamp: number;
      scope: string;
      message: string | null;
    }>;
    let entries = auditRows.map((row) => ({
      id: `audit-${row.id}`,
      timestamp: new Date(row.timestamp).toISOString(),
      level: 'info' as 'info' | 'warn' | 'error',
      scope: row.scope,
      message: row.message ?? row.scope,
    }));
    for (const job of list()) {
      entries.push(...job.log.split('\n').filter(Boolean).map((message, index) => ({
        id: `publish-${job.id}-${index}`,
        timestamp: job.startedAt ?? job.createdAt,
        level: (job.status === 'failed' ? 'error' : 'info') as 'info' | 'error',
        scope: 'publish',
        message,
      })));
    }
    if (query.scope) entries = entries.filter((entry) => entry.scope.includes(query.scope!));
    if (query.level) entries = entries.filter((entry) => entry.level === query.level);
    entries.sort((left, right) => right.timestamp.localeCompare(left.timestamp));
    return paged(entries, Number(query.page ?? 1));
  });

  return { coordinator, listJobs: list };
}
