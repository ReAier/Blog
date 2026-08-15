import { parseDocument } from 'yaml';
import type { PostDocument } from '../../shared/content-types';
import { ContentValidationError } from './errors';

const postFields = [
  'title',
  'description',
  'publishedAt',
  'updatedAt',
  'tags',
  'draft',
  'featured',
  'cover',
] as const;
const postFieldSet = new Set<string>(postFields);
const slugPattern = /^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function validateSlug(slug: string): void {
  if (!slugPattern.test(slug)) {
    throw new ContentValidationError('Post slug must use lowercase kebab-case.', { slug });
  }
}

function validateDate(value: unknown, field: string): string {
  if (typeof value !== 'string' || !datePattern.test(value)) {
    throw new ContentValidationError(`${field} must use YYYY-MM-DD.`, { field, value });
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new ContentValidationError(`${field} must use a valid YYYY-MM-DD date.`, { field, value });
  }
  return value;
}

function requiredString(record: Record<string, unknown>, field: string): string {
  const value = record[field];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ContentValidationError(`${field} must be a non-empty string.`, { field });
  }
  return value;
}

function optionalString(record: Record<string, unknown>, field: string): string | undefined {
  const value = record[field];
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ContentValidationError(`${field} must be a non-empty string when provided.`, { field });
  }
  return value;
}

function requiredBoolean(record: Record<string, unknown>, field: string): boolean {
  const value = record[field];
  if (typeof value !== 'boolean') {
    throw new ContentValidationError(`${field} must be a boolean.`, { field, value });
  }
  return value;
}

function parseFrontmatter(markdown: string): { data: Record<string, unknown>; body: string } {
  const normalized = markdown.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  if (!normalized.startsWith('---\n')) {
    throw new ContentValidationError('Post Markdown must start with a frontmatter block.');
  }
  const closingOffset = normalized.indexOf('\n---', 4);
  if (closingOffset < 0) {
    throw new ContentValidationError('Post frontmatter closing delimiter is missing.');
  }
  const delimiterEnd = closingOffset + 4;
  if (normalized[delimiterEnd] !== undefined && normalized[delimiterEnd] !== '\n') {
    throw new ContentValidationError('Post frontmatter closing delimiter must be on its own line.');
  }

  const source = normalized.slice(4, closingOffset);
  const topLevelFields = new Set<string>();
  for (const line of source.split('\n')) {
    const match = /^([A-Za-z][A-Za-z0-9]*):(?:\s|$)/.exec(line);
    if (!match) continue;
    if (topLevelFields.has(match[1])) {
      throw new ContentValidationError(`Duplicate frontmatter field: ${match[1]}.`, {
        field: match[1],
      });
    }
    topLevelFields.add(match[1]);
  }

  const document = parseDocument(source, {
    prettyErrors: false,
    schema: 'core',
    strict: true,
    uniqueKeys: true,
  });
  if (document.errors.length > 0) {
    const message = document.errors[0].message;
    if (/map keys must be unique/i.test(message)) {
      const duplicate = /"([^"\n]+)"/.exec(message)?.[1];
      throw new ContentValidationError(`Duplicate frontmatter field${duplicate ? `: ${duplicate}` : ''}.`);
    }
    throw new ContentValidationError(`Invalid post frontmatter: ${message}`);
  }
  const value = document.toJS();
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ContentValidationError('Post frontmatter must be a mapping.');
  }

  let body = normalized.slice(delimiterEnd);
  if (body.startsWith('\n')) body = body.slice(1);
  if (body.startsWith('\n')) body = body.slice(1);
  return { data: value as Record<string, unknown>, body };
}

export function parsePostMarkdown(markdown: string, slug: string): PostDocument {
  validateSlug(slug);
  const { data, body } = parseFrontmatter(markdown);

  for (const field of Object.keys(data)) {
    if (!postFieldSet.has(field)) {
      throw new ContentValidationError(`Unknown frontmatter field: ${field}.`, { field });
    }
  }

  const publishedAt = validateDate(data.publishedAt, 'publishedAt');
  const updatedAt = data.updatedAt === undefined
    ? undefined
    : validateDate(data.updatedAt, 'updatedAt');
  if (updatedAt && updatedAt < publishedAt) {
    throw new ContentValidationError('updatedAt cannot be earlier than publishedAt.');
  }

  if (!Array.isArray(data.tags) || data.tags.some((tag) => typeof tag !== 'string' || !tag.trim())) {
    throw new ContentValidationError('tags must be an array of non-empty strings.');
  }

  return {
    slug,
    title: requiredString(data, 'title'),
    description: requiredString(data, 'description'),
    publishedAt,
    updatedAt,
    tags: [...data.tags] as string[],
    draft: requiredBoolean(data, 'draft'),
    featured: requiredBoolean(data, 'featured'),
    cover: optionalString(data, 'cover'),
    body,
  };
}

function importSlug(fileName: string): string {
  const stem = fileName.replace(/\.md$/i, '').trim();
  const slug = stem
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!slug) {
    throw new ContentValidationError('无法从 Markdown 文件名生成文章 slug，请先使用英文或数字重命名文件。');
  }
  validateSlug(slug);
  return slug;
}

function plainMarkdownTitle(markdown: string, fileName: string): string {
  const heading = markdown.match(/^#\s+(.+?)\s*$/m)?.[1]?.trim();
  return heading || fileName.replace(/\.md$/i, '').trim();
}

function plainMarkdownDescription(markdown: string, fallback: string): string {
  const withoutFences = markdown.replace(/```[\s\S]*?```/g, '');
  const paragraph = withoutFences
    .split(/\n\s*\n/)
    .map((block) => block.replace(/^#{1,6}\s+.*$/gm, '').trim())
    .find((block) => block && !/^(?:[-*>]|\d+\.)\s/.test(block));
  return (paragraph || fallback).replace(/\s+/g, ' ').slice(0, 180);
}

export function parseImportedPostMarkdown(
  markdown: string,
  fileName: string,
  publishedAt: string,
): PostDocument {
  const normalized = markdown.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const candidate = normalized.replace(/^\s*(?=---(?:\n|$))/, '');
  const slug = importSlug(fileName);
  if (candidate.startsWith('---')) return parsePostMarkdown(candidate, slug);

  const title = plainMarkdownTitle(normalized, fileName);
  return {
    slug,
    title,
    description: plainMarkdownDescription(normalized, title),
    publishedAt: validateDate(publishedAt, 'publishedAt'),
    tags: [],
    draft: true,
    featured: false,
    body: normalized,
  };
}
function quoteYaml(value: string): string {
  return JSON.stringify(value);
}

export function serializePostMarkdown(post: PostDocument): string {
  validateSlug(post.slug);
  const publishedAt = validateDate(post.publishedAt, 'publishedAt');
  const updatedAt = post.updatedAt === undefined
    ? undefined
    : validateDate(post.updatedAt, 'updatedAt');
  if (updatedAt && updatedAt < publishedAt) {
    throw new ContentValidationError('updatedAt cannot be earlier than publishedAt.');
  }
  if (!Array.isArray(post.tags) || post.tags.some((tag) => typeof tag !== 'string' || !tag.trim())) {
    throw new ContentValidationError('tags must be an array of non-empty strings.');
  }

  const lines = [
    '---',
    `title: ${quoteYaml(requiredString(post as unknown as Record<string, unknown>, 'title'))}`,
    `description: ${quoteYaml(requiredString(post as unknown as Record<string, unknown>, 'description'))}`,
    `publishedAt: ${publishedAt}`,
  ];
  if (updatedAt) lines.push(`updatedAt: ${updatedAt}`);
  if (post.tags.length === 0) lines.push('tags: []');
  else {
    lines.push('tags:');
    for (const tag of post.tags) lines.push(`  - ${quoteYaml(tag)}`);
  }
  lines.push(`draft: ${requiredBoolean(post as unknown as Record<string, unknown>, 'draft')}`);
  lines.push(`featured: ${requiredBoolean(post as unknown as Record<string, unknown>, 'featured')}`);
  const cover = optionalString(post as unknown as Record<string, unknown>, 'cover');
  if (cover) lines.push(`cover: ${quoteYaml(cover)}`);
  lines.push('---');

  const body = post.body.replace(/\r\n?/g, '\n').replace(/^\n+/, '');
  return `${lines.join('\n')}\n${body ? `\n${body}` : ''}`;
}
