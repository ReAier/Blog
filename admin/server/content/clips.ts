import { mkdir, readdir, rename, rm, stat } from 'node:fs/promises';
import { basename, parse } from 'node:path';
import type {
  ClipDocument,
  ClipMetadata,
  ClipReference,
  ContentMutationOptions,
} from '../../shared/content-types';
import {
  ContentConflictError,
  ContentDuplicateError,
  ContentNotFoundError,
  ContentValidationError,
} from './errors';
import { parsePostMarkdown } from './markdown';
import { resolveContentPath } from './paths';
import { readTextFile, sha256Revision, writeTextFileAtomic } from './storage';

const legacyClipFields = new Set([
  'title',
  'description',
  'language',
  'file',
  'createdAt',
  'updatedAt',
]);
const datePattern = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z)?$/;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface ClipFence {
  metadata?: ClipMetadata;
  slug: string;
  start: number;
  end: number;
}

interface PostSnapshot {
  slug: string;
  path: string;
  markdown: string;
  revision: string;
  fences: ClipFence[];
}

interface ClipManifest extends ClipMetadata {
  version: 1;
}

function validateSlug(slug: string): string {
  if (!slugPattern.test(slug)) {
    throw new ContentValidationError(`Invalid clip slug: ${slug}`, { slug });
  }
  return slug;
}

function validateDate(value: string, field: string): string {
  if (!datePattern.test(value) || Number.isNaN(new Date(value.length === 10 ? `${value}T00:00:00.000Z` : value).valueOf())) {
    throw new ContentValidationError(`Clip ${field} must use YYYY-MM-DD or an ISO UTC timestamp.`, {
      field,
      value,
    });
  }
  return value;
}

function requiredField(fields: Map<string, string>, field: string): string {
  const value = fields.get(field);
  if (!value) throw new ContentValidationError(`Clip ${field} is required.`, { field });
  return value;
}

export function deriveClipSlug(file: string): string {
  const slug = parse(file).name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return validateSlug(slug);
}

function validateMetadata(metadata: ClipMetadata): ClipMetadata {
  const file = metadata.file.trim();
  if (basename(file) !== file || file === '.' || file === '..' || file === 'meta.json') {
    throw new ContentValidationError('Clip file must name one source file inside its clip directory.', {
      file,
    });
  }
  if (!metadata.title.trim()) throw new ContentValidationError('Clip title is required.');
  if (!metadata.language.trim()) throw new ContentValidationError('Clip language is required.');
  const createdAt = validateDate(metadata.createdAt, 'createdAt');
  const updatedAt = metadata.updatedAt ? validateDate(metadata.updatedAt, 'updatedAt') : undefined;
  if (updatedAt && updatedAt < createdAt) {
    throw new ContentValidationError('Clip updatedAt cannot be earlier than createdAt.');
  }
  return {
    title: metadata.title.trim(),
    description: metadata.description?.trim() || undefined,
    language: metadata.language.trim(),
    file,
    createdAt,
    updatedAt,
  };
}

export function parseClipMetadata(source: string): ClipMetadata {
  const fields = new Map<string, string>();
  for (const line of source.replace(/\r\n?/g, '\n').split('\n')) {
    if (!line.trim()) continue;
    const separator = line.indexOf(':');
    if (separator < 1) throw new ContentValidationError(`Invalid clip field line: ${line}`);
    const field = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (!legacyClipFields.has(field)) {
      throw new ContentValidationError(`Unknown clip field: ${field}.`, { field });
    }
    if (fields.has(field)) throw new ContentValidationError(`Duplicate clip field: ${field}.`, { field });
    if (!value) throw new ContentValidationError(`Clip ${field} cannot be empty.`, { field });
    fields.set(field, value);
  }
  return validateMetadata({
    title: requiredField(fields, 'title'),
    description: fields.get('description'),
    language: requiredField(fields, 'language'),
    file: requiredField(fields, 'file'),
    createdAt: requiredField(fields, 'createdAt'),
    updatedAt: fields.get('updatedAt'),
  });
}

export function serializeClipMetadata(metadata: ClipMetadata): string {
  const value = validateMetadata(metadata);
  return [
    '```clip',
    `title: ${value.title}`,
    value.description ? `description: ${value.description}` : undefined,
    `language: ${value.language}`,
    `file: ${value.file}`,
    `createdAt: ${value.createdAt}`,
    value.updatedAt ? `updatedAt: ${value.updatedAt}` : undefined,
    '```',
  ].filter((line): line is string => line !== undefined).join('\n');
}

export function serializeClipReference(slug: string): string {
  return `\`\`\`clip\nslug: ${validateSlug(slug)}\n\`\`\``;
}

function linesWithOffsets(markdown: string): Array<{
  start: number;
  contentEnd: number;
  end: number;
  text: string;
}> {
  const lines: Array<{ start: number; contentEnd: number; end: number; text: string }> = [];
  const pattern = /[^\r\n]*(?:\r\n|\r|\n|$)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(markdown)) !== null) {
    if (match[0] === '' && match.index === markdown.length) break;
    const text = match[0].replace(/\r\n$|\r$|\n$/, '');
    lines.push({
      start: match.index,
      contentEnd: match.index + text.length,
      end: match.index + match[0].length,
      text,
    });
    if (pattern.lastIndex === match.index) pattern.lastIndex += 1;
  }
  return lines;
}

export function scanClipFences(markdown: string): ClipFence[] {
  const normalized = markdown.replace(/^\uFEFF/, '');
  const lines = linesWithOffsets(normalized);
  const fences: ClipFence[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const opening = /^ {0,3}(`{3,}|~{3,})[ \t]*clip[ \t]*$/.exec(lines[index].text);
    if (!opening) continue;
    const marker = opening[1][0];
    const minimumLength = opening[1].length;
    const closingPattern = new RegExp(`^ {0,3}${marker === '`' ? '`' : '~'}{${minimumLength},}[ \\t]*$`);
    let closingIndex = index + 1;
    while (closingIndex < lines.length && !closingPattern.test(lines[closingIndex].text)) closingIndex += 1;
    if (closingIndex >= lines.length) throw new ContentValidationError('Clip fence is missing its closing delimiter.');
    const body = normalized.slice(lines[index].end, lines[closingIndex].start).replace(/\r\n?$|\n$/, '').trim();
    const reference = /^slug\s*:\s*([a-z0-9]+(?:-[a-z0-9]+)*)\s*$/.exec(body);
    if (reference) {
      fences.push({ slug: validateSlug(reference[1]), start: lines[index].start, end: lines[closingIndex].contentEnd });
    } else {
      const metadata = parseClipMetadata(body);
      fences.push({
        metadata,
        slug: deriveClipSlug(metadata.file),
        start: lines[index].start,
        end: lines[closingIndex].contentEnd,
      });
    }
    index = closingIndex;
  }
  return fences;
}

export function scanClipReferences(markdown: string): string[] {
  return scanClipFences(markdown).map((fence) => fence.slug);
}

async function listPostFiles(blogRoot: string): Promise<string[]> {
  try {
    return (await readdir(blogRoot, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.md'))
      .map((entry) => resolveContentPath(blogRoot, entry.name))
      .sort((left, right) => left.localeCompare(right));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

async function loadPosts(root: string): Promise<PostSnapshot[]> {
  const posts: PostSnapshot[] = [];
  for (const path of await listPostFiles(resolveContentPath(root, 'blog'))) {
    const snapshot = await readTextFile(path);
    const slug = basename(path, '.md');
    parsePostMarkdown(snapshot.content, slug);
    posts.push({ slug, path, markdown: snapshot.content, revision: snapshot.revision, fences: scanClipFences(snapshot.content) });
  }
  return posts;
}

async function directoryExists(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}

function parseManifest(content: string, slug: string): ClipManifest {
  let raw: unknown;
  try {
    raw = JSON.parse(content);
  } catch {
    throw new ContentValidationError(`Clip manifest is not valid JSON: ${slug}`, { slug });
  }
  if (!raw || typeof raw !== 'object' || (raw as { version?: unknown }).version !== 1) {
    throw new ContentValidationError(`Clip manifest version must be 1: ${slug}`, { slug });
  }
  const value = raw as Record<string, unknown>;
  return {
    version: 1,
    ...validateMetadata({
      title: String(value.title ?? ''),
      description: value.description === undefined ? undefined : String(value.description),
      language: String(value.language ?? ''),
      file: String(value.file ?? ''),
      createdAt: String(value.createdAt ?? ''),
      updatedAt: value.updatedAt === undefined ? undefined : String(value.updatedAt),
    }),
  };
}

function manifestText(metadata: ClipMetadata): string {
  return `${JSON.stringify({ version: 1, ...validateMetadata(metadata) }, null, 2)}\n`;
}

async function loadRegistry(root: string, references: Map<string, ClipReference[]>): Promise<ClipDocument[]> {
  const clipsRoot = resolveContentPath(root, 'clips');
  let entries;
  try {
    entries = await readdir(clipsRoot, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
  const documents: ClipDocument[] = [];
  for (const entry of entries.filter((item) => item.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    const slug = validateSlug(entry.name);
    const directory = resolveContentPath(clipsRoot, slug);
    const manifestSnapshot = await readTextFile(resolveContentPath(directory, 'meta.json'));
    const manifest = parseManifest(manifestSnapshot.content, slug);
    const source = await readTextFile(resolveContentPath(directory, manifest.file));
    const { version: _version, ...metadata } = manifest;
    documents.push({
      slug,
      ...metadata,
      code: source.content,
      metadataRevision: manifestSnapshot.revision,
      codeRevision: source.revision,
      references: references.get(slug) ?? [],
    });
  }
  return documents;
}

async function loadLegacy(root: string, posts: PostSnapshot[], references: Map<string, ClipReference[]>): Promise<ClipDocument[]> {
  const definitions = posts.flatMap((post) => post.fences
    .filter((fence): fence is ClipFence & { metadata: ClipMetadata } => Boolean(fence.metadata))
    .map((fence) => ({ post, fence })));
  const seenFiles = new Map<string, string>();
  const seenSlugs = new Map<string, string>();
  const result: ClipDocument[] = [];
  for (const { post, fence } of definitions) {
    const previousFile = seenFiles.get(fence.metadata.file);
    if (previousFile) throw new ContentDuplicateError(`Duplicate clip file: ${fence.metadata.file}`, { posts: [previousFile, post.slug] });
    const previousSlug = seenSlugs.get(fence.slug);
    if (previousSlug) throw new ContentDuplicateError(`Duplicate clip slug: ${fence.slug}`, { posts: [previousSlug, post.slug] });
    seenFiles.set(fence.metadata.file, post.slug);
    seenSlugs.set(fence.slug, post.slug);
    const source = await readTextFile(resolveContentPath(root, 'clips', fence.metadata.file)).catch((error) => {
      if (error instanceof ContentNotFoundError) {
        throw new ContentNotFoundError(`Clip "${fence.slug}" source file does not exist: ${fence.metadata.file}`);
      }
      throw error;
    });
    result.push({
      slug: fence.slug,
      ...fence.metadata,
      code: source.content,
      metadataRevision: post.revision,
      codeRevision: source.revision,
      references: references.get(fence.slug) ?? [],
    });
  }
  return result;
}

export async function listClips(root: string): Promise<ClipDocument[]> {
  const posts = await loadPosts(root);
  const references = new Map<string, ClipReference[]>();
  for (const post of posts) {
    for (const fence of post.fences) {
      const list = references.get(fence.slug) ?? [];
      if (!list.some((item) => item.postSlug === post.slug)) list.push({ postSlug: post.slug, kind: 'body' });
      references.set(fence.slug, list);
    }
  }
  const registry = await loadRegistry(root, references);
  const registrySlugs = new Set(registry.map((clip) => clip.slug));
  const legacy = (await loadLegacy(root, posts, references)).filter((clip) => !registrySlugs.has(clip.slug));
  const all = [...registry, ...legacy].sort((left, right) => left.slug.localeCompare(right.slug));
  const available = new Set(all.map((clip) => clip.slug));
  const missing = [...references.keys()].filter((slug) => !available.has(slug));
  if (missing.length) {
    throw new ContentNotFoundError(`Missing clip references: ${missing.join(', ')}`, { slugs: missing });
  }
  return all;
}

export async function readClip(root: string, slug: string): Promise<ClipDocument> {
  const clip = (await listClips(root)).find((item) => item.slug === slug);
  if (!clip) throw new ContentNotFoundError(`Clip does not exist: ${slug}`, { slug });
  return clip;
}

export async function createClip(
  root: string,
  slug: string,
  metadata: ClipMetadata,
  code: string,
): Promise<ClipDocument> {
  validateSlug(slug);
  const directory = resolveContentPath(root, 'clips', slug);
  if (await directoryExists(directory)) throw new ContentDuplicateError(`Clip slug already exists: ${slug}`, { slug });
  const value = validateMetadata(metadata);
  await mkdir(directory, { recursive: false });
  try {
    await writeTextFileAtomic(resolveContentPath(directory, 'meta.json'), manifestText(value), { expectedRevision: null });
    await writeTextFileAtomic(resolveContentPath(directory, value.file), code, { expectedRevision: null });
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
  return readClip(root, slug);
}

export async function updateClipMetadata(
  root: string,
  slug: string,
  metadata: ClipMetadata,
  options: ContentMutationOptions = {},
): Promise<ClipDocument> {
  const previous = await readClip(root, slug);
  const directory = resolveContentPath(root, 'clips', slug);
  if (!await directoryExists(directory)) {
    throw new ContentValidationError('Legacy clips must be migrated before editing metadata.', { slug });
  }
  const value = validateMetadata(metadata);
  if (value.file !== previous.file) {
    await rename(resolveContentPath(directory, previous.file), resolveContentPath(directory, value.file));
  }
  try {
    await writeTextFileAtomic(resolveContentPath(directory, 'meta.json'), manifestText(value), options);
  } catch (error) {
    if (value.file !== previous.file) {
      await rename(resolveContentPath(directory, value.file), resolveContentPath(directory, previous.file)).catch(() => undefined);
    }
    throw error;
  }
  return readClip(root, slug);
}

export async function updateClipCode(
  root: string,
  slug: string,
  code: string,
  options: ContentMutationOptions = {},
): Promise<ClipDocument> {
  const clip = await readClip(root, slug);
  const directory = resolveContentPath(root, 'clips', slug);
  if (!await directoryExists(directory)) {
    throw new ContentValidationError('Legacy clips must be migrated before editing source.', { slug });
  }
  await writeTextFileAtomic(resolveContentPath(directory, clip.file), code, options);
  return readClip(root, slug);
}

export async function deleteClip(root: string, slug: string): Promise<void> {
  const clip = await readClip(root, slug);
  if (clip.references.length) {
    throw new ContentConflictError('Clip is still referenced by content.', {
      slug,
      references: clip.references,
    });
  }
  const directory = resolveContentPath(root, 'clips', slug);
  if (!await directoryExists(directory)) {
    throw new ContentValidationError('Legacy clips must be migrated before deletion.', { slug });
  }
  await rm(directory, { recursive: true });
}

export async function migrateClipDirectory(root: string, oldSlug: string, newSlug: string): Promise<void> {
  validateSlug(newSlug);
  const oldDirectory = resolveContentPath(root, 'clips', oldSlug);
  const newDirectory = resolveContentPath(root, 'clips', newSlug);
  if (!await directoryExists(oldDirectory)) throw new ContentNotFoundError(`Clip does not exist: ${oldSlug}`);
  if (await directoryExists(newDirectory)) throw new ContentDuplicateError(`Clip slug already exists: ${newSlug}`);
  await rename(oldDirectory, newDirectory);
}

export function clipManifestRevision(metadata: ClipMetadata): string {
  return sha256Revision(manifestText(metadata));
}
