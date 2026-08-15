import { randomUUID } from 'node:crypto';

export type PublishStatus = 'queued' | 'validating' | 'building' | 'switching' | 'succeeded' | 'failed';

export interface PublishJob {
  id: string;
  status: PublishStatus;
  releaseId?: string;
  contentHash: string;
  log: string;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
}

export interface PublishSnapshot {
  workspace: string;
  contentHash: string;
}

export interface PublishContext {
  jobId: string;
  log(message: string): void;
}

interface PublishDependencies {
  snapshot(): Promise<PublishSnapshot>;
  validate(snapshot: PublishSnapshot, context: PublishContext): Promise<unknown>;
  build(
    snapshot: PublishSnapshot,
    context: PublishContext,
  ): Promise<{ releaseId?: string } | void>;
  switchRelease(
    snapshot: PublishSnapshot,
    build: { releaseId?: string } | void,
    context: PublishContext,
  ): Promise<{ releaseId?: string } | void>;
  cleanup(snapshot: PublishSnapshot, context: PublishContext): Promise<unknown>;
}

type PublishListener = (job: PublishJob) => void;

export class PublishCoordinator {
  private readonly jobs = new Map<string, PublishJob>();
  private readonly running = new Map<string, Promise<void>>();
  private readonly listeners = new Map<string, Set<PublishListener>>();
  private queue = Promise.resolve();

  constructor(private readonly dependencies: PublishDependencies) {}

  private emit(job: PublishJob): void {
    for (const listener of this.listeners.get(job.id) ?? []) listener({ ...job });
  }

  private setStatus(job: PublishJob, status: PublishStatus): void {
    job.status = status;
    if (status === 'validating') job.startedAt = new Date().toISOString();
    if (status === 'succeeded' || status === 'failed') job.finishedAt = new Date().toISOString();
    this.emit(job);
  }

  private append(job: PublishJob, message: string): void {
    const normalized = message.replace(/\r\n?/g, '\n').replace(/\n+$/g, '');
    if (!normalized) return;
    job.log += `${normalized}\n`;
    this.emit(job);
  }

  async publish(): Promise<PublishJob> {
    const snapshot = await this.dependencies.snapshot();
    const job: PublishJob = {
      id: randomUUID(),
      status: 'queued',
      contentHash: snapshot.contentHash,
      log: '',
      createdAt: new Date().toISOString(),
    };
    this.jobs.set(job.id, job);
    const context: PublishContext = {
      jobId: job.id,
      log: (message) => this.append(job, message),
    };
    this.emit(job);

    const run = this.queue.then(async () => {
      try {
        this.setStatus(job, 'validating');
        context.log('Validating content snapshot.');
        await this.dependencies.validate(snapshot, context);
        this.setStatus(job, 'building');
        context.log('Running the production build pipeline.');
        const build = await this.dependencies.build(snapshot, context);
        this.setStatus(job, 'switching');
        context.log('Switching the public release.');
        const switched = await this.dependencies.switchRelease(snapshot, build, context);
        job.releaseId = switched?.releaseId ?? build?.releaseId;
        this.setStatus(job, 'succeeded');
        context.log(`Published ${job.releaseId ?? job.contentHash.slice(0, 12)}.`);
      } catch (error) {
        this.append(job, error instanceof Error ? error.stack ?? error.message : String(error));
        this.setStatus(job, 'failed');
      } finally {
        try {
          await this.dependencies.cleanup(snapshot, context);
        } catch (error) {
          this.append(job, `Cleanup failed: ${String(error)}`);
        }
      }
    });

    this.running.set(job.id, run);
    this.queue = run.catch(() => undefined);
    void run.finally(() => this.running.delete(job.id));
    return { ...job };
  }

  get(id: string): PublishJob | undefined {
    const job = this.jobs.get(id);
    return job ? { ...job } : undefined;
  }

  list(): PublishJob[] {
    return [...this.jobs.values()]
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map((job) => ({ ...job }));
  }

  subscribe(id: string, listener: PublishListener): () => void {
    const listeners = this.listeners.get(id) ?? new Set<PublishListener>();
    listeners.add(listener);
    this.listeners.set(id, listeners);
    const current = this.jobs.get(id);
    if (current) listener({ ...current });
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) this.listeners.delete(id);
    };
  }

  async wait(id: string): Promise<PublishJob | undefined> {
    await this.running.get(id);
    return this.get(id);
  }
}