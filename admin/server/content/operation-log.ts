import { randomUUID } from 'node:crypto';
import { cp, mkdir, readFile, readdir, rename, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { writeTextFileAtomic } from './storage';

interface OperationState {
  id: string;
  type: string;
  phase: 'prepared' | 'committed';
  createdAt: string;
}

const operationQueues = new Map<string, Promise<unknown>>();

async function restoreSnapshot(contentRoot: string, snapshotRoot: string): Promise<void> {
  const target = resolve(contentRoot);
  const replacement = resolve(dirname(target), `.${randomUUID()}-operation-restore`);
  await rm(replacement, { recursive: true, force: true });
  await cp(snapshotRoot, replacement, { recursive: true, force: false, errorOnExist: true });
  await rm(target, { recursive: true, force: true });
  await rename(replacement, target);
}

async function runOperation<T>(options: {
  contentRoot: string;
  operationsRoot: string;
  type: string;
  execute(): Promise<T>;
}): Promise<T> {
  const id = `${Date.now()}-${randomUUID()}`;
  const operationRoot = resolve(options.operationsRoot, id);
  const snapshotRoot = resolve(operationRoot, 'before');
  const statePath = resolve(operationRoot, 'state.json');
  await mkdir(operationRoot, { recursive: true });
  await cp(resolve(options.contentRoot), snapshotRoot, {
    recursive: true,
    force: false,
    errorOnExist: true,
  });
  const state: OperationState = {
    id,
    type: options.type,
    phase: 'prepared',
    createdAt: new Date().toISOString(),
  };
  await writeTextFileAtomic(statePath, `${JSON.stringify(state, null, 2)}\n`, {
    expectedRevision: null,
  });

  try {
    const result = await options.execute();
    await writeTextFileAtomic(statePath, `${JSON.stringify({ ...state, phase: 'committed' }, null, 2)}\n`);
    await rm(operationRoot, { recursive: true, force: true });
    return result;
  } catch (error) {
    await restoreSnapshot(options.contentRoot, snapshotRoot);
    await rm(operationRoot, { recursive: true, force: true });
    throw error;
  }
}

export function withContentOperation<T>(options: {
  contentRoot: string;
  operationsRoot: string;
  type: string;
  execute(): Promise<T>;
}): Promise<T> {
  const key = resolve(options.contentRoot);
  const previous = operationQueues.get(key) ?? Promise.resolve();
  const operation = previous.then(
    () => runOperation(options),
    () => runOperation(options),
  );
  operationQueues.set(key, operation);
  void operation.then(
    () => { if (operationQueues.get(key) === operation) operationQueues.delete(key); },
    () => { if (operationQueues.get(key) === operation) operationQueues.delete(key); },
  );
  return operation;
}

export async function recoverInterruptedContentOperations(options: {
  contentRoot: string;
  operationsRoot: string;
}): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(options.operationsRoot, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }

  const recovered: string[] = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (!entry.isDirectory()) continue;
    const operationRoot = resolve(options.operationsRoot, entry.name);
    let state: OperationState;
    try {
      state = JSON.parse(await readFile(resolve(operationRoot, 'state.json'), 'utf8')) as OperationState;
    } catch {
      continue;
    }
    if (state.phase === 'committed') {
      await rm(operationRoot, { recursive: true, force: true });
      continue;
    }
    await restoreSnapshot(options.contentRoot, resolve(operationRoot, 'before'));
    await rm(operationRoot, { recursive: true, force: true });
    recovered.push(state.id);
  }
  return recovered;
}
