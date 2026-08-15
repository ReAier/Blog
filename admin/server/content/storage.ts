import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rename, rm, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { ContentMutationOptions, RevisionedText } from '../../shared/content-types';
import { ContentConflictError, ContentNotFoundError } from './errors';

export function sha256Revision(content: string | Uint8Array): string {
  return createHash('sha256').update(content).digest('hex');
}

async function currentRevision(path: string): Promise<string | null> {
  try {
    const content = await readFile(path);
    return sha256Revision(content);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

export async function readTextFile(path: string): Promise<RevisionedText> {
  try {
    const content = await readFile(path, 'utf8');
    return { content, revision: sha256Revision(content) };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new ContentNotFoundError(`Content file does not exist: ${path}`, { path });
    }
    throw error;
  }
}

export async function writeTextFileAtomic(
  path: string,
  content: string,
  options: ContentMutationOptions = {},
): Promise<{ revision: string }> {
  const actualRevision = await currentRevision(path);
  if (options.expectedRevision !== undefined && options.expectedRevision !== actualRevision) {
    throw new ContentConflictError('Content revision does not match expectedRevision.', {
      path,
      expectedRevision: options.expectedRevision,
      actualRevision,
    });
  }

  const directory = dirname(path);
  await mkdir(directory, { recursive: true });
  const temporaryPath = join(directory, `.${randomUUID()}.tmp`);
  const handle = await open(temporaryPath, 'wx');
  try {
    await handle.writeFile(content, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }

  try {
    await rename(temporaryPath, path);
  } catch (error) {
    await rm(temporaryPath, { force: true });
    throw error;
  }

  const result = await stat(path);
  if (!result.isFile()) {
    throw new ContentConflictError(`Atomic write target is not a file: ${path}`, { path });
  }
  return { revision: sha256Revision(content) };
}
