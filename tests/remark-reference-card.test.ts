import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import { describe, expect, it } from 'vitest';
import { remarkReferenceCards } from '../src/lib/remark-reference-card';

async function render(markdown: string) {
  const processor = await createMarkdownProcessor({
    syntaxHighlight: false,
    smartypants: false,
    remarkPlugins: [remarkReferenceCards],
  });
  return (await processor.render(markdown)).code;
}

describe('remark reference cards', () => {
  it('renders a complete external reference card', async () => {
    const html = await render(`\`\`\`reference
url: https://docs.example.com/articles/card?mode=full&lang=zh
title: 示例：外部引用卡片
description: 一段由文章作者维护的简介。
\`\`\``);

    expect(html).toContain('class="reference-card glass"');
    expect(html).toContain('data-reference-card');
    expect(html).toContain('docs.example.com');
    expect(html).toContain('示例：外部引用卡片');
    expect(html).toContain('一段由文章作者维护的简介。');
    expect(html).toMatch(/href="https:\/\/docs\.example\.com\/articles\/card\?mode=full(?:&amp;|&#x26;)lang=zh"/);
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).not.toContain('reference-card__action');
    expect(html).not.toContain('访问原文');
  });

  it('supports a card without a description', async () => {
    const html = await render(`\`\`\`reference
url: https://example.com/
title: 只有标题
\`\`\``);

    expect(html).toContain('只有标题');
    expect(html).not.toContain('reference-card__description');
  });

  it('escapes user-provided HTML while preserving colons in values', async () => {
    const html = await render(`\`\`\`reference
url: https://example.com/path
title: API: <script>alert("x")</script>
description: 使用 A & B: 安全示例
\`\`\``);

    expect(html).toContain('API: &#x3C;script>alert("x")&#x3C;/script>');
    expect(html).toContain('使用 A &#x26; B: 安全示例');
    expect(html).not.toContain('<script>alert');
  });

  it('leaves ordinary code fences unchanged', async () => {
    const html = await render('```text\nurl: https://example.com\n```');
    expect(html).toContain('url: https://example.com');
    expect(html).not.toContain('data-reference-card');
  });

  it.each([
    ['missing URL', '```reference\ntitle: Example\n```', 'url is required'],
    ['missing title', '```reference\nurl: https://example.com\n```', 'title is required'],
    ['relative URL', '```reference\nurl: /article\ntitle: Example\n```', 'absolute http or https URL'],
    ['unsupported protocol', '```reference\nurl: ftp://example.com/file\ntitle: Example\n```', 'absolute http or https URL'],
    ['duplicate field', '```reference\nurl: https://example.com\ntitle: One\ntitle: Two\n```', 'Duplicate reference field "title"'],
    ['unknown field', '```reference\nurl: https://example.com\ntitle: Example\nauthor: Aier\n```', 'Unknown reference field "author"'],
    ['malformed line', '```reference\nurl https://example.com\ntitle: Example\n```', 'key: value'],
    ['empty value', '```reference\nurl: https://example.com\ntitle:\n```', 'title must not be empty'],
    ['multiline continuation', '```reference\nurl: https://example.com\ntitle: Example\ncontinued text\n```', 'key: value'],
  ])('rejects %s', async (_label, markdown, message) => {
    await expect(render(markdown)).rejects.toThrow(message);
  });
});
