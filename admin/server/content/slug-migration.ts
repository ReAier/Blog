import { basename, extname } from 'node:path';
import type { ClipDocument, StoredPostDocument } from '../../shared/content-types';
import { ContentConflictError, ContentDuplicateError, ContentValidationError } from './errors';
import {
  deriveClipSlug,
  migrateClipDirectory,
  scanClipFences,
  serializeClipReference,
} from './clips';
import { serializePostMarkdown } from './markdown';
import { resolveContentPath } from './paths';
import type { ContentRepository } from './repository';
import { readTextFile, writeTextFileAtomic } from './storage';
import { combinedClipRevision } from './transactions';

function replaceAllPaths(value: string, replacements: Array<[string, string]>): string {
  return replacements.reduce(
    (current, [source, target]) => current.replaceAll(source, target),
    value,
  );
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await readTextFile(path);
    return true;
  } catch (error) {
    if ((error as { code?: string }).code === 'CONTENT_NOT_FOUND') return false;
    throw error;
  }
}

async function readRedirects(root: string): Promise<Record<string, string>> {
  const path = resolveContentPath(root, 'redirects.json');
  try {
    return JSON.parse((await readTextFile(path)).content) as Record<string, string>;
  } catch (error) {
    if ((error as { code?: string }).code === 'CONTENT_NOT_FOUND') return {};
    throw error;
  }
}

async function writeRedirects(root: string, redirects: Record<string, string>): Promise<void> {
  await writeTextFileAtomic(
    resolveContentPath(root, 'redirects.json'),
    `${JSON.stringify(redirects, null, 2)}\n`,
  );
}

async function rewritePosts(
  repository: ContentRepository,
  transform: (post: StoredPostDocument) => StoredPostDocument,
  skippedSlug?: string,
): Promise<void> {
  for (const post of await repository.listPosts()) {
    if (post.slug === skippedSlug) continue;
    const next = transform(post);
    if (next.body === post.body && next.cover === post.cover) continue;
    await repository.updatePost(post.slug, next, { expectedRevision: post.revision });
  }
}

export async function migratePostSlug(options: {
  repository: ContentRepository;
  oldSlug: string;
  newSlug: string;
  expectedRevision: string;
}): Promise<StoredPostDocument> {
  const { repository, oldSlug, newSlug, expectedRevision } = options;
  const previous = await repository.readPost(oldSlug);
  if (previous.revision !== expectedRevision) {
    throw new ContentConflictError('Post revision changed before slug migration.', {
      actualRevision: previous.revision,
    });
  }
  if (newSlug === oldSlug) return previous;
  const newPostPath = resolveContentPath(repository.root, 'blog', `${newSlug}.md`);
  if (await fileExists(newPostPath)) {
    throw new ContentDuplicateError(`Post slug already exists: ${newSlug}`);
  }

  const migrated = {
    ...previous,
    slug: newSlug,
    body: replaceAllPaths(previous.body, [[`/posts/${oldSlug}/`, `/posts/${newSlug}/`]]),
  };
  await writeTextFileAtomic(newPostPath, serializePostMarkdown(migrated), { expectedRevision: null });
  const { rm } = await import('node:fs/promises');
  await rm(resolveContentPath(repository.root, 'blog', `${oldSlug}.md`));

  await rewritePosts(repository, (post) => ({
    ...post,
    body: replaceAllPaths(post.body, [[`/posts/${oldSlug}/`, `/posts/${newSlug}/`]]),
  }), newSlug);

  const redirects = await readRedirects(repository.root);
  redirects[`/posts/${oldSlug}/`] = `/posts/${newSlug}/`;
  await writeRedirects(repository.root, redirects);
  return repository.readPost(newSlug);
}

function rewriteClipReferenceBody(body: string, oldSlug: string, newSlug: string): string {
  const fences = scanClipFences(body).filter((fence) => fence.slug === oldSlug).reverse();
  let next = body;
  for (const fence of fences) {
    next = `${next.slice(0, fence.start)}${serializeClipReference(newSlug)}${next.slice(fence.end)}`;
  }
  return replaceAllPaths(next, [
    [`/clips/${oldSlug}/`, `/clips/${newSlug}/`],
    [`/clips/${oldSlug}.txt`, `/clips/${newSlug}.txt`],
  ]);
}

export async function migrateClipSlug(options: {
  repository: ContentRepository;
  oldSlug: string;
  newFile: string;
  expectedRevision: string;
}): Promise<ClipDocument> {
  const { repository, oldSlug, newFile, expectedRevision } = options;
  const previous = await repository.readClip(oldSlug);
  const actualRevision = combinedClipRevision(previous);
  if (actualRevision !== expectedRevision) {
    throw new ContentConflictError('Clip revision changed before slug migration.', { actualRevision });
  }
  if (basename(newFile) !== newFile || !extname(newFile)) {
    throw new ContentValidationError('The migrated clip file must be a single file name with an extension.');
  }
  const newSlug = deriveClipSlug(newFile);
  if (newSlug === oldSlug && newFile === previous.file) return previous;
  if ((await repository.listClips()).some((clip) => clip.slug === newSlug)) {
    throw new ContentDuplicateError(`Clip already exists: ${newSlug}`);
  }

  await migrateClipDirectory(repository.root, oldSlug, newSlug);
  const directory = resolveContentPath(repository.root, 'clips', newSlug);
  if (newFile !== previous.file) {
    const { rename } = await import('node:fs/promises');
    await rename(
      resolveContentPath(directory, previous.file),
      resolveContentPath(directory, newFile),
    );
  }
  await writeTextFileAtomic(
    resolveContentPath(directory, 'meta.json'),
    `${JSON.stringify({
      version: 1,
      title: previous.title,
      ...(previous.description ? { description: previous.description } : {}),
      language: previous.language,
      file: newFile,
      createdAt: previous.createdAt,
      ...(previous.updatedAt ? { updatedAt: previous.updatedAt } : {}),
    }, null, 2)}\n`,
    { expectedRevision: previous.metadataRevision },
  );

  await rewritePosts(repository, (post) => ({
    ...post,
    body: rewriteClipReferenceBody(post.body, oldSlug, newSlug),
  }));

  const redirects = await readRedirects(repository.root);
  redirects[`/clips/${oldSlug}/`] = `/clips/${newSlug}/`;
  redirects[`/clips/${oldSlug}.txt`] = `/clips/${newSlug}.txt`;
  await writeRedirects(repository.root, redirects);
  return repository.readClip(newSlug);
}
