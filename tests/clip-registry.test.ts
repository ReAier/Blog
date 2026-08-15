import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  countClipLines,
  createClipRecord,
  extractClipDefinitions,
  formatClipBytes,
  loadClips,
  parseClipDefinition,
} from '../src/lib/clips';

const validFence = `title: Astro：配置示例
description: 用于验证云剪切板：支持冒号。
language: typescript
file: astro.config.ts
createdAt: 2026-08-03`;

async function createTempRoots() {
  const root = await mkdtemp(join(tmpdir(), 'aier-clips-'));
  const clipsRoot = join(root, 'clips');
  const blogRoot = join(root, 'blog');
  await mkdir(clipsRoot);
  await mkdir(blogRoot);
  return { root, clipsRoot, blogRoot };
}

describe('clip registry', () => {
  it('anchors production sources and declarations to project content directories', async () => {
    const source = await import('node:fs/promises').then(({ readFile }) =>
      readFile(new URL('../src/lib/clips.ts', import.meta.url), 'utf8'),
    );
    expect(source).toContain("import { getContentPaths } from './content-paths'");
    expect(source).toContain('const contentPaths = getContentPaths()');
    expect(source).toContain('const clipsRoot = contentPaths.clips');
    expect(source).toContain('const blogRoot = contentPaths.blog');
  });

  it('parses fenced metadata and derives stable URLs and source statistics', () => {
    const definition = parseClipDefinition(validFence);
    const clip = createClipRecord(definition, 'const answer = 42;\n');

    expect(definition).toEqual({
      slug: 'astro-config',
      title: 'Astro：配置示例',
      description: '用于验证云剪切板：支持冒号。',
      language: 'typescript',
      file: 'astro.config.ts',
      createdAt: '2026-08-03',
      updatedAt: undefined,
    });
    expect(clip.slug).toBe('astro-config');
    expect(clip.lineCount).toBe(1);
    expect(clip.byteSize).toBe(Buffer.byteLength('const answer = 42;\n'));
    expect(clip.pageUrl).toBe('/clips/astro-config/');
    expect(clip.rawUrl).toBe('/clips/astro-config.txt');
  });

  it.each([
    ['legacy slug-only syntax', 'astro-config', 'key: value'],
    ['missing title', validFence.replace('title: Astro：配置示例\n', ''), 'title is required'],
    ['explicit slug', `slug: manual-slug\n${validFence}`, 'Unknown clip field "slug"'],
    ['invalid derived slug', validFence.replace('astro.config.ts', '你好.cpp'), 'cannot derive a slug'],
    ['empty title', validFence.replace('title: Astro：配置示例', 'title:'), 'title must not be empty'],
    ['unknown field', `${validFence}\nauthor: Aier`, 'Unknown clip field "author"'],
    ['duplicate field', `${validFence}\ntitle: Duplicate`, 'Duplicate clip field "title"'],
    ['unsafe file', validFence.replace('file: astro.config.ts', 'file: ../secret.ts'), 'file must name one source file'],
    ['nested file', validFence.replace('file: astro.config.ts', 'file: nested/example.ts'), 'file must name one source file'],
    ['bad created date', validFence.replace('2026-08-03', '03/08/2026'), 'createdAt must use YYYY-MM-DD'],
    ['bad updated date', `${validFence}\nupdatedAt: 2026-02-30`, 'updatedAt is not a valid date'],
    ['reversed dates', `${validFence}\nupdatedAt: 2026-08-02`, 'updatedAt cannot be earlier'],
  ])('rejects %s', (_label, value, message) => {
    expect(() => parseClipDefinition(value)).toThrow(message);
  });

  it('extracts only top-level clip fences from Markdown', () => {
    const markdown = `---\ntitle: Example\ndraft: false\n---\n\n${'```'}clip\n${validFence}\n${'```'}\n\n${'````'}markdown\n${'```'}clip\nslug: documented-only\n${'```'}\n${'````'}`;
    const definitions = extractClipDefinitions(markdown);
    expect(definitions).toHaveLength(1);
    expect(definitions[0]?.slug).toBe('astro-config');
  });

  it('loads declarations from published posts and ignores every YAML form of draft true', async () => {
    const { root, clipsRoot, blogRoot } = await createTempRoots();
    await writeFile(join(clipsRoot, 'example.ts'), 'export const explicit = true;\n', 'utf8');
    await writeFile(join(clipsRoot, 'no-draft.ts'), 'export const implicit = true;\n', 'utf8');
    await writeFile(join(clipsRoot, 'unused.ts'), 'export const unused = true;\n', 'utf8');
    await writeFile(
      join(blogRoot, 'published.md'),
      `---\ntitle: Published\ndraft: false\n---\n\n${'```'}clip\n${validFence.replace('astro.config.ts', 'example.ts')}\n${'```'}`,
      'utf8',
    );
    await writeFile(
      join(blogRoot, 'published-without-draft.md'),
      `---\ntitle: Published without draft\n---\n\n${'```'}clip\n${validFence.replace('astro.config.ts', 'no-draft.ts')}\n${'```'}`,
      'utf8',
    );

    const draftFrontmatter = [
      ['plain', 'draft: true'],
      ['tagged', 'draft: !!bool true'],
      ['anchored', 'draft: &publishState true'],
    ] as const;
    for (const [name, draft] of draftFrontmatter) {
      await writeFile(
        join(blogRoot, `draft-${name}.md`),
        `---\ntitle: Draft ${name}\n${draft}\n---\n\n${'```'}clip\n${validFence.replace('astro.config.ts', `missing-${name}.ts`)}\n${'```'}`,
        'utf8',
      );
    }

    try {
      const clips = loadClips(clipsRoot, blogRoot);
      expect(clips.map((clip) => clip.slug)).toEqual(['example', 'no-draft']);
      expect(clips.map((clip) => clip.code)).toEqual([
        'export const explicit = true;\n',
        'export const implicit = true;\n',
      ]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('propagates invalid frontmatter instead of publishing its clips', async () => {
    const { root, clipsRoot, blogRoot } = await createTempRoots();
    await writeFile(
      join(blogRoot, 'invalid.md'),
      `---\ntitle: Invalid\ndraft: [true\n---\n\n${'```'}clip\n${validFence}\n${'```'}`,
      'utf8',
    );

    try {
      expect(() => loadClips(clipsRoot, blogRoot)).toThrow();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('rejects duplicate slugs across published posts', async () => {
    const { root, clipsRoot, blogRoot } = await createTempRoots();
    await writeFile(join(clipsRoot, 'example.ts'), 'export {};\n', 'utf8');
    const definition = validFence.replace('astro.config.ts', 'example.ts');
    await writeFile(join(blogRoot, 'one.md'), `\`\`\`clip\n${definition}\n\`\`\``, 'utf8');
    await writeFile(join(blogRoot, 'two.md'), `\`\`\`clip\n${definition}\n\`\`\``, 'utf8');

    try {
      expect(() => loadClips(clipsRoot, blogRoot)).toThrow('Duplicate clip slug: example');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('rejects declarations whose flat source file does not exist', async () => {
    const { root, clipsRoot, blogRoot } = await createTempRoots();
    await writeFile(join(blogRoot, 'post.md'), `\`\`\`clip\n${validFence}\n\`\`\``, 'utf8');

    try {
      expect(() => loadClips(clipsRoot, blogRoot)).toThrow('source file does not exist: astro.config.ts');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('counts lines and formats byte sizes for cards and detail pages', () => {
    expect(countClipLines('')).toBe(0);
    expect(countClipLines('one')).toBe(1);
    expect(countClipLines('one\ntwo\n')).toBe(2);
    expect(countClipLines('one\r\ntwo')).toBe(2);
    expect(formatClipBytes(999)).toBe('999 B');
    expect(formatClipBytes(1536)).toBe('1.5 KB');
  });
});
