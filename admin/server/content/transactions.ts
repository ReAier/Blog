import type { ClipDocument, ClipMetadata } from '../../shared/content-types';
import { ContentConflictError, ContentDuplicateError, ContentValidationError } from './errors';
import { scanClipFences, serializeClipReference } from './clips';
import type { ContentRepository } from './repository';
import { sha256Revision } from './storage';
import { assertTextWithinLimit, MAX_CLIP_BYTES } from '../limits';

export interface CreateClipInput extends ClipMetadata {
  slug: string;
  code: string;
  ownerPostSlug?: string;
  insertOffset?: number;
  expectedPostRevision?: string;
}

export interface UpdateClipInput extends ClipMetadata {
  code: string;
  expectedRevision: string;
}

export function combinedClipRevision(
  clip: Pick<ClipDocument, 'metadataRevision' | 'codeRevision'>,
): string {
  return sha256Revision(`${clip.metadataRevision}:${clip.codeRevision}`);
}

function insertFence(body: string, fence: string, requestedOffset?: number): string {
  const offset = requestedOffset === undefined ? body.length : requestedOffset;
  if (!Number.isInteger(offset) || offset < 0 || offset > body.length) {
    throw new ContentValidationError('Clip insertOffset is outside the post body.', { offset });
  }
  const prefix = offset > 0 && body[offset - 1] !== '\n' ? '\n\n' : '';
  const suffix = offset < body.length && body[offset] !== '\n' ? '\n\n' : '';
  return `${body.slice(0, offset)}${prefix}${fence}${suffix}${body.slice(offset)}`;
}

export async function createClipTransaction(
  repository: ContentRepository,
  input: CreateClipInput,
): Promise<ClipDocument> {
  assertTextWithinLimit(input.code, 'BLOG_MAX_CLIP_BYTES', MAX_CLIP_BYTES, 'Clip source');
  if ((await repository.listClips()).some((clip) => clip.slug === input.slug)) {
    throw new ContentDuplicateError(`Clip already exists: ${input.slug}`);
  }
  const metadata: ClipMetadata = {
    title: input.title,
    description: input.description || undefined,
    language: input.language,
    file: input.file,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  };
  const clip = await repository.createClip(input.slug, metadata, input.code);
  if (!input.ownerPostSlug) return clip;

  try {
    const post = await repository.readPost(input.ownerPostSlug);
    if (input.expectedPostRevision && input.expectedPostRevision !== post.revision) {
      throw new ContentConflictError('Post revision does not match expectedPostRevision.', {
        expectedRevision: input.expectedPostRevision,
        actualRevision: post.revision,
      });
    }
    const body = insertFence(post.body, serializeClipReference(input.slug), input.insertOffset);
    await repository.updatePost(post.slug, { ...post, body }, { expectedRevision: post.revision });
    return repository.readClip(input.slug);
  } catch (error) {
    await repository.deleteClip(input.slug).catch(() => undefined);
    throw error;
  }
}

export async function updateClipTransaction(
  repository: ContentRepository,
  slug: string,
  input: UpdateClipInput,
): Promise<ClipDocument> {
  assertTextWithinLimit(input.code, 'BLOG_MAX_CLIP_BYTES', MAX_CLIP_BYTES, 'Clip source');
  const previous = await repository.readClip(slug);
  const actualRevision = combinedClipRevision(previous);
  if (input.expectedRevision !== actualRevision) {
    throw new ContentConflictError('Clip revision does not match expectedRevision.', {
      slug,
      expectedRevision: input.expectedRevision,
      actualRevision,
    });
  }
  const metadata: ClipMetadata = {
    title: input.title,
    description: input.description || undefined,
    language: input.language,
    file: input.file,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  };
  let updated = previous;
  if (
    metadata.title !== previous.title
    || metadata.description !== previous.description
    || metadata.language !== previous.language
    || metadata.file !== previous.file
    || metadata.createdAt !== previous.createdAt
    || metadata.updatedAt !== previous.updatedAt
  ) {
    updated = await repository.updateClipMetadata(slug, metadata, {
      expectedRevision: previous.metadataRevision,
    });
  }
  if (input.code !== previous.code) {
    updated = await repository.updateClipCode(slug, input.code, {
      expectedRevision: previous.codeRevision,
    });
  }
  return updated;
}

export async function attachClipToPostTransaction(
  repository: ContentRepository,
  postSlug: string,
  clipSlug: string,
  options: { expectedPostRevision: string; insertOffset?: number },
): Promise<void> {
  await repository.readClip(clipSlug);
  const post = await repository.readPost(postSlug);
  if (post.revision !== options.expectedPostRevision) {
    throw new ContentConflictError('Post revision does not match expectedPostRevision.');
  }
  const body = insertFence(post.body, serializeClipReference(clipSlug), options.insertOffset);
  await repository.updatePost(post.slug, { ...post, body }, { expectedRevision: post.revision });
}

export async function removeClipFromPostTransaction(
  repository: ContentRepository,
  postSlug: string,
  clipSlug: string,
  options: { expectedPostRevision: string; trashRoot?: string; trashSource?: boolean },
): Promise<void> {
  const post = await repository.readPost(postSlug);
  if (post.revision !== options.expectedPostRevision) {
    throw new ContentConflictError('Post revision does not match expectedPostRevision.');
  }
  const fence = scanClipFences(post.body).find((item) => item.slug === clipSlug);
  if (!fence) throw new ContentValidationError('Clip reference cannot be located in the post.');
  const nextBody = `${post.body.slice(0, fence.start)}${post.body.slice(fence.end)}`
    .replace(/\n{3,}/g, '\n\n');
  await repository.updatePost(post.slug, { ...post, body: nextBody }, { expectedRevision: post.revision });
}
