import { readFileSync, readdirSync, statSync, type Dirent } from 'node:fs';
import { basename, dirname, join, parse, resolve } from 'node:path';

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
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const allowedFields = new Set([
  'title',
  'description',
  'language',
  'file',
  'createdAt',
  'updatedAt',
]);
const clipsRoot = resolve(process.cwd(), 'src/content/clips');
const blogRoot = resolve(process.cwd(), 'src/content/blog');

function requiredField(fields: Map<string, string>, field: string): string {
  const value = fields.get(field);
  if (value === undefined) throw new Error(`Clip ${field} is required.`);
  return value;
}

export function deriveClipSlug(file: string): string {
  const slug = parse(file).name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');
  const normalized = slug.replace(/^-+|-+$/g, '');
  if (!normalized || !slugPattern.test(normalized)) {
    throw new Error(`Clip file cannot derive a slug: ${file}`);
  }
  return normalized;
}

function isoDate(value: string, field: string): string {
  if (!datePattern.test(value)) throw new Error(`Clip ${field} must use YYYY-MM-DD.`);
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error(`Clip ${field} is not a valid date.`);
  }
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

  const title = requiredField(fields, 'title');
  const language = requiredField(fields, 'language');
  const file = requiredField(fields, 'file');
  const createdAt = isoDate(requiredField(fields, 'createdAt'), 'createdAt');
  const updatedValue = fields.get('updatedAt');
  const updatedAt = updatedValue === undefined ? undefined : isoDate(updatedValue, 'updatedAt');

  if (basename(file) !== file || file === 'meta.json') {
    throw new Error('Clip file must name one source file in src/content/clips.');
  }
  const slug = deriveClipSlug(file);
  if (updatedAt && updatedAt < createdAt) {
    throw new Error('Clip updatedAt cannot be earlier than createdAt.');
  }

  return {
    slug,
    title,
    description: fields.get('description'),
    language,
    file,
    createdAt,
    updatedAt,
  };
}

export function countClipLines(code: string): number {
  if (code.length === 0) return 0;
  const normalized = code.replace(/\r\n?/g, '\n');
  const withoutFinalNewline = normalized.endsWith('\n') ? normalized.slice(0, -1) : normalized;
  return withoutFinalNewline.length === 0 ? 1 : withoutFinalNewline.split('\n').length;
}

export function formatClipBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kilobytes = bytes / 1024;
  return `${Number(kilobytes.toFixed(1))} KB`;
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

export function extractClipDefinitions(markdown: string): ClipDefinition[] {
  const definitions: ClipDefinition[] = [];
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
      if (fence.info === 'clip') definitions.push(parseClipDefinition(fence.body.join('\n')));
      fence = undefined;
      continue;
    }

    fence.body.push(line);
  }

  if (fence?.info === 'clip') definitions.push(parseClipDefinition(fence.body.join('\n')));
  return definitions;
}

function isDraftMarkdown(markdown: string): boolean {
  const frontmatter = /^\uFEFF?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(markdown);
  return frontmatter ? /^draft\s*:\s*true\s*(?:#.*)?$/im.test(frontmatter[1]) : false;
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

export function loadClips(sourceRoot = clipsRoot, postsRoot = blogRoot): ClipRecord[] {
  const definitions = new Map<string, { definition: ClipDefinition; postPath: string }>();

  for (const postPath of listMarkdownFiles(postsRoot).sort((left, right) => left.localeCompare(right))) {
    const markdown = readFileSync(postPath, 'utf8');
    if (isDraftMarkdown(markdown)) continue;

    for (const definition of extractClipDefinitions(markdown)) {
      const previous = definitions.get(definition.slug);
      if (previous) {
        throw new Error(
          `Duplicate clip slug: ${definition.slug} (${previous.postPath} and ${postPath})`,
        );
      }
      definitions.set(definition.slug, { definition, postPath });
    }
  }

  return [...definitions.values()]
    .map(({ definition }) => loadClip(definition, sourceRoot))
    .sort((left, right) => left.slug.localeCompare(right.slug));
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
