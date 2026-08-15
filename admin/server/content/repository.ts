import { mkdir, readdir, rename, stat } from 'node:fs/promises';
import { basename, dirname, extname, relative, resolve } from 'node:path';
import type {
  ClipDocument,
  ClipMetadata,
  ContentHistoryWriter,
  ContentMutationOptions,
  ImageAsset,
  PostDocument,
  StoredPostDocument,
} from '../../shared/content-types';
import {
  createClip as createClipDocument,
  deleteClip as deleteClipDocument,
  readClip as readClipDocument,
  listClips as listClipDocuments,
  updateClipCode as updateClipSourceCode,
  updateClipMetadata as updateClipManifestMetadata,
} from './clips';
import {
  ContentConflictError,
  ContentDuplicateError,
  ContentNotFoundError,
  ContentValidationError,
} from './errors';
import { listImages as listImageAssets } from './images';
import { parsePostMarkdown, serializePostMarkdown } from './markdown';
import { getContentRoot, resolveContentPath } from './paths';
import { readTextFile, writeTextFileAtomic } from './storage';
import { assertTextWithinLimit, MAX_MARKDOWN_BYTES } from '../limits';

export interface ContentRepositoryOptions {
  root?: string;
  history?: ContentHistoryWriter;
}

export interface ListPostsOptions {
  includeDeleted?: boolean;
}

export interface ContentRepository {
  readonly root: string;
  listPosts(options?: ListPostsOptions): Promise<StoredPostDocument[]>;
  readPost(slug: string): Promise<StoredPostDocument>;
  createPost(post: PostDocument): Promise<StoredPostDocument>;
  updatePost(
    slug: string,
    post: PostDocument,
    options?: ContentMutationOptions,
  ): Promise<StoredPostDocument>;
  softDeletePost(
    slug: string,
    options?: ContentMutationOptions,
  ): Promise<StoredPostDocument>;
  restorePost(
    slug: string,
    options?: ContentMutationOptions,
  ): Promise<StoredPostDocument>;
  listClips(): Promise<ClipDocument[]>;
  readClip(slug: string): Promise<ClipDocument>;
  createClip(slug: string, metadata: ClipMetadata, code: string): Promise<ClipDocument>;
  deleteClip(slug: string): Promise<void>;
  updateClipMetadata(
    slug: string,
    metadata: ClipMetadata,
    options?: ContentMutationOptions,
  ): Promise<ClipDocument>;
  updateClipCode(
    slug: string,
    code: string,
    options?: ContentMutationOptions,
  ): Promise<ClipDocument>;
  listImages(): Promise<ImageAsset[]>;
}

function postFileName(slug: string): string {
  parsePostMarkdown(
    `---\ntitle: x\ndescription: x\npublishedAt: 2000-01-01\ntags: []\ndraft: false\nfeatured: false\n---\n`,
    slug,
  );
  return `${slug}.md`;
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}

async function listMarkdownPaths(directory: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }

  const paths: string[] = [];
  for (const entry of entries) {
    const path = resolveContentPath(directory, entry.name);
    if (entry.isDirectory()) {
      paths.push(...await listMarkdownPaths(path));
    } else if (entry.isFile() && extname(entry.name).toLowerCase() === '.md') {
      paths.push(path);
    }
  }
  return paths;
}

function storedPost(
  content: string,
  slug: string,
  fileName: string,
  revision: string,
  deleted: boolean,
): StoredPostDocument {
  return {
    ...parsePostMarkdown(content, slug),
    fileName,
    revision,
    deleted,
  };
}

async function readStoredPost(
  path: string,
  slug: string,
  deleted: boolean,
): Promise<StoredPostDocument> {
  const snapshot = await readTextFile(path);
  return storedPost(snapshot.content, slug, basename(path), snapshot.revision, deleted);
}

function verifyExpectedRevision(
  actualRevision: string,
  expectedRevision: string | null | undefined,
  slug: string,
): void {
  if (expectedRevision !== undefined && expectedRevision !== actualRevision) {
    throw new ContentConflictError('Content revision does not match expectedRevision.', {
      slug,
      expectedRevision,
      actualRevision,
    });
  }
}

export function createContentRepository(
  options: ContentRepositoryOptions = {},
): ContentRepository {
  const root = resolve(options.root ?? getContentRoot());
  const blogRoot = resolveContentPath(root, 'blog');
  const deletedBlogRoot = resolveContentPath(root, '.trash', 'blog');
  const record = async (entry: Parameters<ContentHistoryWriter['record']>[0]): Promise<void> => {
    await options.history?.record(entry);
  };

  const activePath = (slug: string) => resolveContentPath(blogRoot, postFileName(slug));
  const deletedPath = (slug: string) => resolveContentPath(deletedBlogRoot, postFileName(slug));

  async function readPost(slug: string): Promise<StoredPostDocument> {
    const path = activePath(slug);
    if (!await isFile(path)) {
      throw new ContentNotFoundError(`Post does not exist: ${slug}`, { slug });
    }
    return readStoredPost(path, slug, false);
  }

  async function readDeletedPost(slug: string): Promise<StoredPostDocument> {
    const path = deletedPath(slug);
    if (!await isFile(path)) {
      throw new ContentNotFoundError(`Deleted post does not exist: ${slug}`, { slug });
    }
    return readStoredPost(path, slug, true);
  }

  async function listArea(directory: string, deleted: boolean): Promise<StoredPostDocument[]> {
    const paths = await listMarkdownPaths(directory);
    return Promise.all(paths.map(async (path) => {
      const relativePath = relative(directory, path).replace(/\\/g, '/');
      const fileName = basename(path);
      const slug = fileName.slice(0, -extname(fileName).length);
      if (relativePath.includes('/')) {
        throw new ContentValidationError(`Post files must be stored directly in blog/: ${relativePath}`);
      }
      return readStoredPost(path, slug, deleted);
    }));
  }

  async function listPosts(listOptions: ListPostsOptions = {}): Promise<StoredPostDocument[]> {
    const active = await listArea(blogRoot, false);
    const deleted = listOptions.includeDeleted ? await listArea(deletedBlogRoot, true) : [];
    const posts = [...active, ...deleted];
    const seen = new Set<string>();
    for (const item of posts) {
      if (seen.has(item.slug)) {
        throw new ContentDuplicateError(`Duplicate post slug: ${item.slug}`, { slug: item.slug });
      }
      seen.add(item.slug);
    }
    return posts.sort((left, right) => left.slug.localeCompare(right.slug));
  }

  return {
    root,
    listPosts,
    readPost,

    async createPost(post) {
      const path = activePath(post.slug);
      const trashPath = deletedPath(post.slug);
      if (await isFile(path) || await isFile(trashPath)) {
        throw new ContentDuplicateError(`Post slug already exists: ${post.slug}`, { slug: post.slug });
      }
      const content = serializePostMarkdown(post);
      assertTextWithinLimit(content, 'BLOG_MAX_MARKDOWN_BYTES', MAX_MARKDOWN_BYTES, 'Post');
      const result = await writeTextFileAtomic(path, content, { expectedRevision: null });
      const created = storedPost(content, post.slug, basename(path), result.revision, false);
      await record({
        action: 'create',
        entity: 'post',
        id: post.slug,
        beforeRevision: null,
        afterRevision: created.revision,
      });
      return created;
    },

    async updatePost(slug, post, mutationOptions = {}) {
      if (post.slug !== slug) {
        throw new ContentValidationError('Updated post slug must match the requested slug.', {
          requestedSlug: slug,
          postSlug: post.slug,
        });
      }
      const previous = await readPost(slug);
      const path = activePath(slug);
      const content = serializePostMarkdown(post);
      assertTextWithinLimit(content, 'BLOG_MAX_MARKDOWN_BYTES', MAX_MARKDOWN_BYTES, 'Post');
      const result = await writeTextFileAtomic(path, content, mutationOptions);
      const updated = storedPost(content, slug, basename(path), result.revision, false);
      await record({
        action: 'update',
        entity: 'post',
        id: slug,
        beforeRevision: previous.revision,
        afterRevision: updated.revision,
      });
      return updated;
    },

    async softDeletePost(slug, mutationOptions = {}) {
      const post = await readPost(slug);
      verifyExpectedRevision(post.revision, mutationOptions.expectedRevision, slug);
      const destination = deletedPath(slug);
      if (await isFile(destination)) {
        throw new ContentDuplicateError(`Deleted post slug already exists: ${slug}`, { slug });
      }
      await mkdir(dirname(destination), { recursive: true });
      await rename(activePath(slug), destination);
      const deleted = await readDeletedPost(slug);
      await record({
        action: 'soft-delete',
        entity: 'post',
        id: slug,
        beforeRevision: post.revision,
        afterRevision: deleted.revision,
      });
      return deleted;
    },

    async restorePost(slug, mutationOptions = {}) {
      const post = await readDeletedPost(slug);
      verifyExpectedRevision(post.revision, mutationOptions.expectedRevision, slug);
      const destination = activePath(slug);
      if (await isFile(destination)) {
        throw new ContentDuplicateError(`Post slug already exists: ${slug}`, { slug });
      }
      await mkdir(dirname(destination), { recursive: true });
      await rename(deletedPath(slug), destination);
      const restored = await readPost(slug);
      await record({
        action: 'restore',
        entity: 'post',
        id: slug,
        beforeRevision: post.revision,
        afterRevision: restored.revision,
      });
      return restored;
    },

    listClips: () => listClipDocuments(root),
    readClip: (slug) => readClipDocument(root, slug),
    createClip: (slug, metadata, code) => createClipDocument(root, slug, metadata, code),
    deleteClip: (slug) => deleteClipDocument(root, slug),

    async updateClipMetadata(slug, metadata, mutationOptions = {}) {
      const previous = await readClipDocument(root, slug);
      const updated = await updateClipManifestMetadata(root, slug, metadata, mutationOptions);
      await record({
        action: 'update',
        entity: 'clip-metadata',
        id: slug,
        beforeRevision: previous.metadataRevision,
        afterRevision: updated.metadataRevision,
      });
      return updated;
    },

    async updateClipCode(slug, code, mutationOptions = {}) {
      const previous = await readClipDocument(root, slug);
      const updated = await updateClipSourceCode(root, slug, code, mutationOptions);
      await record({
        action: 'update',
        entity: 'clip-code',
        id: slug,
        beforeRevision: previous.codeRevision,
        afterRevision: updated.codeRevision,
      });
      return updated;
    },

    async listImages() {
      return listImageAssets(root, await listPosts());
    },
  };
}
