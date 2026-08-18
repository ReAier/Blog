import { createHash } from 'node:crypto';
import { stat } from 'node:fs/promises';
import type { FastifyRequest } from 'fastify';
import sharp from 'sharp';
import type { ClipDocument, PostDocument } from '../shared/content-types';
import type { AdminPermission, AdminRole } from './auth/admin-keys';
import type { AdminConfig } from './config';
import type { ContentRepository } from './content/repository';
import { ContentValidationError } from './content/errors';
import { resolveContentPath } from './content/paths';
import { combinedClipRevision } from './content/transactions';

export interface Authenticated {
  adminId: number;
  username: string;
  keyId?: string;
  role?: AdminRole;
  permissions?: AdminPermission[];
  csrfToken?: string;
  csrfTokenHash?: string;
  sessionId?: number;
}

export interface EditorPostInput {
  slug: string;
  frontmatter?: {
    title?: string;
    description?: string;
    publishedAt?: string;
    updatedAt?: string;
    tags?: string[];
    draft?: boolean;
    featured?: boolean;
    cover?: string;
  };
  title?: string;
  description?: string;
  publishedAt?: string;
  updatedAt?: string;
  tags?: string[];
  draft?: boolean;
  featured?: boolean;
  cover?: string;
  body?: string;
  expectedRevision?: string;
}

export function adminAuth(request: FastifyRequest): Authenticated {
  return (request as FastifyRequest & { adminAuth: Authenticated }).adminAuth;
}

export function expectedRevision(
  request: FastifyRequest,
  body?: Record<string, unknown>,
): string | undefined {
  const header = request.headers['if-match'];
  return (Array.isArray(header) ? header[0] : header)
    ?? body?.expectedRevision as string | undefined;
}

export function postFromEditorInput(
  input: EditorPostInput,
  slugOverride?: string,
): PostDocument {
  const frontmatter = input.frontmatter ?? input;
  return {
    slug: slugOverride ?? input.slug,
    title: String(frontmatter.title ?? ''),
    description: String(frontmatter.description ?? ''),
    publishedAt: String(frontmatter.publishedAt ?? ''),
    updatedAt: frontmatter.updatedAt ? String(frontmatter.updatedAt) : undefined,
    tags: Array.isArray(frontmatter.tags) ? frontmatter.tags.map(String) : [],
    draft: frontmatter.draft === true,
    featured: frontmatter.featured === true,
    cover: frontmatter.cover ? String(frontmatter.cover) : undefined,
    body: String(input.body ?? ''),
  };
}

export function paged<T>(items: T[], requestedPage = 1, pageSize = 50) {
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const start = (page - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    total: items.length,
    page,
    pageSize,
  };
}

export function presentClip(clip: ClipDocument) {
  const { references: _references, ...presented } = clip;
  return {
    ...presented,
    revision: combinedClipRevision(clip),
  };
}

export function imageId(path: string): string {
  return Buffer.from(path, 'utf8').toString('base64url');
}

export function imagePathFromId(id: string): string {
  const path = Buffer.from(id, 'base64url').toString('utf8');
  if (
    !path
    || path.includes('\\')
    || path.startsWith('/')
    || path.split('/').some((part) => !part || part === '.' || part === '..')
  ) {
    throw new ContentValidationError('Invalid image identifier.');
  }
  return path;
}

export async function presentImage(
  config: AdminConfig,
  image: Awaited<ReturnType<ContentRepository['listImages']>>[number],
) {
  const absolute = resolveContentPath(config.contentRoot, 'images', image.path);
  const [metadata, info] = await Promise.all([sharp(absolute).metadata(), stat(absolute)]);
  const id = imageId(image.path);
  return {
    id,
    name: image.fileName,
    originalName: image.fileName,
    url: `/api/images/${encodeURIComponent(id)}/content`,
    markdownPath: `../images/${image.path}`,
    relativePath: `images/${image.path}`,
    publicUrl: new URL(`/media/${image.path.split('/').map(encodeURIComponent).join('/')}`, config.siteOrigin).toString(),
    width: metadata.width ?? 0,
    height: metadata.height ?? 0,
    byteSize: image.byteSize,
    sha256: image.revision,
    createdAt: info.birthtime.toISOString(),
  };
}

export function sha256(value: Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}
