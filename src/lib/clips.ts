import { parseFrontmatter } from '@astrojs/markdown-remark';
import { readFileSync, readdirSync, statSync, type Dirent } from 'node:fs';
import { basename, dirname, join, parse, resolve } from 'node:path';
import { getContentPaths } from './content-paths';

export interface ClipDefinition {
  slug: string;
  title: string;
  description?: string;
  language: string;
  file: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ClipRecord extends ClipDefinition {
  code: string;
  lineCount: number;
  byteSize: number;
  pageUrl: string;
  rawUrl: string;
}

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const allowedFields = new Set([
  'title',
  'description',
  'language',
  'file',
  'createdAt',
  'updatedAt',
]);
const contentPaths = getContentPaths();
const clipsRoot = contentPaths.clips;
const blogRoot = contentPaths.blog;

function validateSlug(slug: string): string {
  if (!slugPattern.test(slug)) throw new Error(`Invalid clip slug: ${slug}`);
  return slug;
}

function requiredField(fields: Map<string, string>, field: string): string {
  const value = fields.get(field);
  if (value === undefined) throw new Error(`Clip ${field} is required.`);
  return value;
}

export function deriveClipSlug(file: string): string {
  const slug = parse(file).name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!slug) throw new Error(`Clip file cannot derive a slug: ${file}`);
  return validateSlug(slug);
}

function legacyDate(value: string, field: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`Clip ${field} must use YYYY-MM-DD.`);
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error(`Clip ${field} is not a valid date.`);
  }
  return value;
}

function validDate(value: string, field: string): string {
  const parsed = new Date(value.length === 10 ? `${value}T00:00:00.000Z` : value);
  if (Number.isNaN(parsed.valueOf())) throw new Error(`Clip ${field} is not a valid date.`);
  return value;
}

export function parseClipDefinition(value: string): ClipDefinition {
  const fields = new Map<string, string>();
  for (const rawLine of value.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const match = /^([A-Za-z][A-Za-z0-9]*)\s*:\s*(.*)$/.exec(line);
    if (!match) throw new Error('Each clip line must use the "key: value" format.');
    const [, key, fieldValue] = match;
    if (!allowedFields.has(key)) throw new Error(`Unknown clip field "${key}".`);
    if (fields.has(key)) throw new Error(`Duplicate clip field "${key}".`);
    if (!fieldValue) throw new Error(`Clip ${key} must not be empty.`);
    fields.set(key, fieldValue);
  }
  const file = requiredField(fields, 'file');
  if (basename(file) !== file || file === 'meta.json') {
    throw new Error('Clip file must name one source file in src/content/clips.');
  }
  const createdAt = legacyDate(requiredField(fields, 'createdAt'), 'createdAt');
  const updatedAt = fields.get('updatedAt')
    ? legacyDate(requiredField(fields, 'updatedAt'), 'updatedAt')
    : undefined;
  if (updatedAt && updatedAt < createdAt) throw new Error('Clip updatedAt cannot be earlier than createdAt.');
  return {
    slug: deriveClipSlug(file),
    title: requiredField(fields, 'title'),
    description: fields.get('description'),
    language: requiredField(fields, 'language'),
    file,
    createdAt,
    updatedAt,
  };
}

export function parseClipReference(value: string): string | undefined {
  const match = /^\s*slug\s*:\s*([a-z0-9]+(?:-[a-z0-9]+)*)\s*$/.exec(value);
  return match ? validateSlug(match[1]) : undefined;
}

export function countClipLines(code: string): number {
  if (code.length === 0) return 0;
  const normalized = code.replace(/\r\n?/g, '\n');
  const withoutFinalNewline = normalized.endsWith('\n') ? normalized.slice(0, -1) : normalized;
  return withoutFinalNewline.length === 0 ? 1 : withoutFinalNewline.split('\n').length;
}

export function formatClipBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${Number((bytes / 1024).toFixed(1))} KB`;
}

export function createClipRecord(definition: ClipDefinition, code: string): ClipRecord {
  return {
    ...definition,
    code,
    lineCount: countClipLines(code),
    byteSize: Buffer.byteLength(code, 'utf8'),
    pageUrl: `/clips/${definition.slug}/`,
    rawUrl: `/clips/${definition.slug}.txt`,
  };
}

export function loadClip(definition: ClipDefinition, root = clipsRoot): ClipRecord {
  const resolvedRoot = resolve(root);
  const sourcePath = resolve(resolvedRoot, definition.file);
  if (dirname(sourcePath) !== resolvedRoot) {
    throw new Error(`Clip "${definition.slug}" source file escapes src/content/clips.`);
  }
  try {
    if (!statSync(sourcePath).isFile()) throw new Error('not a file');
  } catch {
    throw new Error(`Clip "${definition.slug}" source file does not exist: ${definition.file}`);
  }
  return createClipRecord(definition, readFileSync(sourcePath, 'utf8'));
}

function loadManifestClip(slug: string, root = clipsRoot): ClipRecord {
  validateSlug(slug);
  const directory = resolve(root, slug);
  const manifestPath = resolve(directory, 'meta.json');
  if (dirname(manifestPath) !== directory) throw new Error(`Invalid clip directory: ${slug}`);
  let manifest: Record<string, unknown>;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, unknown>;
  } catch {
    throw new Error(`Clip manifest does not exist or is invalid: ${slug}`);
  }
  if (manifest.version !== 1) throw new Error(`Clip manifest version must be 1: ${slug}`);
  const definition: ClipDefinition = {
    slug,
    title: String(manifest.title ?? ''),
    description: manifest.description === undefined ? undefined : String(manifest.description),
    language: String(manifest.language ?? ''),
    file: String(manifest.file ?? ''),
    createdAt: validDate(String(manifest.createdAt ?? ''), 'createdAt'),
    updatedAt: manifest.updatedAt === undefined
      ? undefined
      : validDate(String(manifest.updatedAt), 'updatedAt'),
  };
  if (!definition.title || !definition.language || basename(definition.file) !== definition.file) {
    throw new Error(`Clip manifest is incomplete: ${slug}`);
  }
  const sourcePath = resolve(directory, definition.file);
  if (dirname(sourcePath) !== directory || !statSync(sourcePath).isFile()) {
    throw new Error(`Clip "${slug}" source file does not exist: ${definition.file}`);
  }
  return createClipRecord(definition, readFileSync(sourcePath, 'utf8'));
}

export function loadClipBySlug(slug: string, root = clipsRoot): ClipRecord {
  return loadManifestClip(slug, root);
}

interface FenceState {
  marker: '`' | '~';
  length: number;
  info: string;
  body: string[];
}

function closingFencePattern(state: FenceState): RegExp {
  const marker = state.marker === '`' ? '`' : '~';
  return new RegExp(`^ {0,3}${marker}{${state.length},}\\s*$`);
}

function extractClipBodies(markdown: string): string[] {
  const bodies: string[] = [];
  let fence: FenceState | undefined;
  for (const line of markdown.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    if (!fence) {
      const opening = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
      if (!opening) continue;
      fence = {
        marker: opening[1][0] as '`' | '~',
        length: opening[1].length,
        info: opening[2].trim(),
        body: [],
      };
      continue;
    }
    if (closingFencePattern(fence).test(line)) {
      if (fence.info === 'clip') bodies.push(fence.body.join('\n'));
      fence = undefined;
      continue;
    }
    fence.body.push(line);
  }
  if (fence?.info === 'clip') bodies.push(fence.body.join('\n'));
  return bodies;
}

export function extractClipDefinitions(markdown: string): ClipDefinition[] {
  return extractClipBodies(markdown)
    .filter((body) => !parseClipReference(body))
    .map(parseClipDefinition);
}

export function extractClipReferences(markdown: string): string[] {
  return extractClipBodies(markdown).map((body) => parseClipReference(body) ?? parseClipDefinition(body).slug);
}

function isDraftMarkdown(markdown: string): boolean {
  return parseFrontmatter(markdown).frontmatter.draft === true;
}

function listMarkdownFiles(root: string): string[] {
  let entries: Dirent[];
  try {
    entries = readdirSync(root, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
  return entries.flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) return listMarkdownFiles(path);
    return entry.isFile() && entry.name.toLowerCase().endsWith('.md') ? [path] : [];
  });
}

function listManifestClips(root: string): ClipRecord[] {
  let entries: Dirent[];
  try {
    entries = readdirSync(root, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => loadManifestClip(entry.name, root));
}

export function loadClips(sourceRoot = clipsRoot, postsRoot = blogRoot): ClipRecord[] {
  const clips = new Map<string, ClipRecord>();
  const manifestSlugs = new Set<string>();
  for (const clip of listManifestClips(sourceRoot)) { clips.set(clip.slug, clip); manifestSlugs.add(clip.slug); }
  const references = new Set<string>();
  for (const postPath of listMarkdownFiles(postsRoot).sort((left, right) => left.localeCompare(right))) {
    const markdown = readFileSync(postPath, 'utf8');
    if (isDraftMarkdown(markdown)) continue;
    for (const body of extractClipBodies(markdown)) {
      const reference = parseClipReference(body);
      if (reference) {
        references.add(reference);
        continue;
      }
      const definition = parseClipDefinition(body);
      if (manifestSlugs.has(definition.slug)) {
        references.add(definition.slug);
        continue;
      }
      if (clips.has(definition.slug)) throw new Error(`Duplicate clip slug: ${definition.slug}`);
      clips.set(definition.slug, loadClip(definition, sourceRoot));
      references.add(definition.slug);
    }
  }
  const missing = [...references].filter((slug) => !clips.has(slug));
  if (missing.length) throw new Error(`Missing clip references: ${missing.join(', ')}`);
  return [...clips.values()].sort((left, right) => left.slug.localeCompare(right.slug));
}

let cachedClips: ClipRecord[] | undefined;

export function getAllClips(): ClipRecord[] {
  cachedClips ??= loadClips();
  return cachedClips;
}

export function getClip(slug: string): ClipRecord {
  const clip = getAllClips().find((item) => item.slug === slug);
  if (!clip) throw new Error(`Unknown clip slug: ${slug}`);
  return clip;
}
