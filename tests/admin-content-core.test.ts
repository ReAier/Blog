import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ContentConflictError,
  ContentPathError,
  ContentValidationError,
  getContentRoot,
  parseImportedPostMarkdown,
  parsePostMarkdown,
  readTextFile,
  resolveContentPath,
  serializePostMarkdown,
  sha256Revision,
  writeTextFileAtomic,
} from '../admin/server/content/index';

const temporaryDirectories: string[] = [];

async function createTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'blog-admin-content-core-'));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

const validMarkdown = `---
title: "A strict post"
description: "Frontmatter is validated"
publishedAt: 2026-08-01
updatedAt: 2026-08-12
tags:
  - "Astro"
  - "Admin"
draft: false
featured: true
cover: "../images/a-cover.webp"
---

Hello, content core.\n`;

describe('content root path safety', () => {
  it('defaults BLOG_CONTENT_ROOT to src/content under the working directory', () => {
    expect(getContentRoot({ cwd: 'D:/example', env: {} })).toBe(resolve('D:/example', 'src/content'));
    expect(getContentRoot({ cwd: 'D:/example', env: { BLOG_CONTENT_ROOT: 'private/content' } })).toBe(
      resolve('D:/example', 'private/content'),
    );
  });

  it('resolves descendants and rejects traversal, absolute paths, and prefix lookalikes', () => {
    const root = resolve('D:/example/src/content');

    expect(resolveContentPath(root, 'blog', 'safe-post.md')).toBe(
      resolve(root, 'blog', 'safe-post.md'),
    );
    expect(() => resolveContentPath(root, '..', 'outside.md')).toThrow(ContentPathError);
    expect(() => resolveContentPath(root, 'blog/../../outside.md')).toThrow(ContentPathError);
    expect(() => resolveContentPath(root, resolve('D:/example/src/content-evil/file.md'))).toThrow(
      ContentPathError,
    );
  });
});

describe('strict post Markdown parsing', () => {
  it('parses the supported schema without coercing dates or booleans', () => {
    expect(parsePostMarkdown(validMarkdown, 'strict-post')).toEqual({
      slug: 'strict-post',
      title: 'A strict post',
      description: 'Frontmatter is validated',
      publishedAt: '2026-08-01',
      updatedAt: '2026-08-12',
      tags: ['Astro', 'Admin'],
      draft: false,
      featured: true,
      cover: '../images/a-cover.webp',
      body: 'Hello, content core.\n',
    });
  });

  it('rejects unknown and duplicate fields', () => {
    expect(() => parsePostMarkdown(validMarkdown.replace('draft: false', 'author: Aier'), 'strict-post'))
      .toThrow(/unknown frontmatter field: author/i);
    expect(() => parsePostMarkdown(validMarkdown.replace('draft: false', 'title: Again'), 'strict-post'))
      .toThrow(/duplicate.*title/i);
  });

  it('validates slugs and calendar dates', () => {
    expect(() => parsePostMarkdown(validMarkdown, '../escape')).toThrow(ContentValidationError);
    expect(() => parsePostMarkdown(validMarkdown, 'Upper_Case')).toThrow(/slug/i);
    expect(() => parsePostMarkdown(validMarkdown.replace('2026-08-01', '2026-02-30'), 'strict-post'))
      .toThrow(/publishedAt.*YYYY-MM-DD/i);
    expect(() => parsePostMarkdown(validMarkdown.replace('2026-08-12', '2026-07-31'), 'strict-post'))
      .toThrow(/updatedAt.*earlier/i);
  });

  it('serializes frontmatter in a stable field order and round trips', () => {
    const document = parsePostMarkdown(validMarkdown, 'strict-post');
    const serialized = serializePostMarkdown(document);
    const fieldOffsets = [
      'title:',
      'description:',
      'publishedAt:',
      'updatedAt:',
      'tags:',
      'draft:',
      'featured:',
      'cover:',
    ].map((field) => serialized.indexOf(field));

    expect(fieldOffsets).toEqual([...fieldOffsets].sort((left, right) => left - right));
    expect(serializePostMarkdown(parsePostMarkdown(serialized, 'strict-post'))).toBe(serialized);
  });
});

describe('post Markdown import parsing', () => {
  it('accepts BOM and blank lines before valid frontmatter', () => {
    const imported = parseImportedPostMarkdown(`\uFEFF\n\n${validMarkdown}`, 'strict-post.md', '2026-08-15');

    expect(imported.slug).toBe('strict-post');
    expect(imported.title).toBe('A strict post');
  });

  it('creates draft frontmatter for plain Markdown', () => {
    const imported = parseImportedPostMarkdown(
      '# Imported title\n\nA useful introductory paragraph.\n\nMore text.\n',
      'My Imported_Post.md',
      '2026-08-15',
    );

    expect(imported).toEqual({
      slug: 'my-imported-post',
      title: 'Imported title',
      description: 'A useful introductory paragraph.',
      publishedAt: '2026-08-15',
      tags: [],
      draft: true,
      featured: false,
      body: '# Imported title\n\nA useful introductory paragraph.\n\nMore text.\n',
    });
  });

  it('falls back to the file name when plain Markdown has no prose', () => {
    const imported = parseImportedPostMarkdown(
      '```ts\nconst value = 1;\n```\n',
      'Code Sample.md',
      '2026-08-15',
    );

    expect(imported.title).toBe('Code Sample');
    expect(imported.description).toBe('Code Sample');
    expect(imported.slug).toBe('code-sample');
  });

  it('does not treat malformed frontmatter as plain Markdown', () => {
    expect(() => parseImportedPostMarkdown('---\ntitle: Broken\n', 'broken.md', '2026-08-15'))
      .toThrow(/frontmatter closing delimiter/i);
  });
});
describe('revision-aware atomic text storage', () => {
  it('uses the lowercase SHA-256 digest as a file revision', async () => {
    const directory = await createTemporaryDirectory();
    const path = join(directory, 'post.md');
    await writeFile(path, 'hello', 'utf8');

    const snapshot = await readTextFile(path);

    expect(snapshot).toEqual({
      content: 'hello',
      revision: sha256Revision('hello'),
    });
    expect(snapshot.revision).toMatch(/^[a-f0-9]{64}$/);
  });

  it('creates and replaces through an atomic write without leaving temporary files', async () => {
    const directory = await createTemporaryDirectory();
    const path = join(directory, 'post.md');

    const created = await writeTextFileAtomic(path, 'first', { expectedRevision: null });
    const updated = await writeTextFileAtomic(path, 'second', { expectedRevision: created.revision });

    expect(await readFile(path, 'utf8')).toBe('second');
    expect(updated.revision).toBe(sha256Revision('second'));
    expect((await import('node:fs/promises')).readdir(directory)).resolves.toEqual(['post.md']);
  });

  it('rejects stale and create-only revisions without changing the file', async () => {
    const directory = await createTemporaryDirectory();
    const path = join(directory, 'post.md');
    await writeFile(path, 'current', 'utf8');

    await expect(
      writeTextFileAtomic(path, 'stale write', { expectedRevision: sha256Revision('old') }),
    ).rejects.toBeInstanceOf(ContentConflictError);
    await expect(
      writeTextFileAtomic(path, 'duplicate create', { expectedRevision: null }),
    ).rejects.toBeInstanceOf(ContentConflictError);
    await expect(readFile(path, 'utf8')).resolves.toBe('current');
  });
});
