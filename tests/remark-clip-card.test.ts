import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import { access, mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { remarkClipCards } from '../src/lib/remark-clip-card';

const clipFixture = resolve(process.cwd(), 'src/content/clips/remark-clip-fixture.ts');
let createdClipFixture = false;

beforeAll(async () => {
  try {
    await access(clipFixture);
  } catch {
    await mkdir(resolve(process.cwd(), 'src/content/clips'), { recursive: true });
    await writeFile(clipFixture, 'export default {};\n', 'utf8');
    createdClipFixture = true;
  }
});

afterAll(async () => {
  if (createdClipFixture) await rm(clipFixture, { force: true });
});

const completeFence = `title: Astro：配置示例
description: 云剪切板：围栏元数据示例。
language: typescript
file: remark-clip-fixture.ts
createdAt: 2026-08-03`;

async function render(markdown: string) {
  const processor = await createMarkdownProcessor({
    syntaxHighlight: false,
    smartypants: false,
    remarkPlugins: [remarkClipCards],
  });
  return (await processor.render(markdown)).code;
}

describe('remark clip cards', () => {
  it('turns a metadata fence into a deferred-copy card', async () => {
    const html = await render(`\`\`\`clip\n${completeFence}\n\`\`\``);

    expect(html).toContain('data-clip-card');
    expect(html).toContain('Astro：配置示例');
    expect(html).toContain('typescript');
    expect(html).toContain('/clips/remark-clip-fixture/');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain('clip-card__actions');
    expect(html).not.toContain('data-copy-clip');
    expect(html).not.toContain('/clips/remark-clip-fixture.txt');
    expect(html).not.toContain("filter: (page) => !page.includes('/clips/')");
  });

  it('supports an omitted description and escapes author-provided HTML', async () => {
    const html = await render(`\`\`\`clip\n${completeFence
      .replace('description: 云剪切板：围栏元数据示例。\n', '')
      .replace('Astro：配置示例', 'API: <script>alert("x")</script>')}\n\`\`\``);

    expect(html).not.toContain('<script>alert');
    expect(html).not.toContain('<p></p>');
  });

  it('leaves nested clip fences unchanged because only top-level declarations are registered', async () => {
    const markdown = completeFence.split('\n').map((line) => `> ${line}`).join('\n');
    const html = await render(`> \`\`\`clip\n${markdown}\n> \`\`\``);
    expect(html).not.toContain('data-clip-card');
    expect(html).toContain('file: remark-clip-fixture.ts');
  });

  it('leaves ordinary code and reference fences unchanged', async () => {
    const code = await render('```ts\nconst answer = 42;\n```');
    const reference = await render('```reference\nurl: https://example.com\ntitle: Example\n```');
    expect(code).toContain('const answer = 42;');
    expect(code).not.toContain('data-clip-card');
    expect(reference).toContain('url: https://example.com');
    expect(reference).not.toContain('data-clip-card');
  });

  it.each([
    ['legacy slug-only syntax', '```clip\nremark-clip-fixture\n```', 'key: value'],
    ['missing source', `\`\`\`clip\n${completeFence.replace('remark-clip-fixture.ts', 'missing.ts')}\n\`\`\``, 'source file does not exist'],
    ['explicit slug', `\`\`\`clip\nslug: manual-slug\n${completeFence}\n\`\`\``, 'Unknown clip field "slug"'],
    ['unknown field', `\`\`\`clip\n${completeFence}\nauthor: Aier\n\`\`\``, 'Unknown clip field'],
  ])('rejects %s', async (_label, markdown, message) => {
    await expect(render(markdown)).rejects.toThrow(message);
  });
});
