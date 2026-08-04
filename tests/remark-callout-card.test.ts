import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import { describe, expect, it } from 'vitest';
import { remarkCalloutCards } from '../src/lib/remark-callout-card';

async function render(markdown: string) {
  const processor = await createMarkdownProcessor({
    syntaxHighlight: false,
    smartypants: false,
    remarkPlugins: [remarkCalloutCards],
  });
  return (await processor.render(markdown)).code;
}

describe('remark callout cards', () => {
  it('renders a collapsed callout with Markdown content', async () => {
    const html = await render(`\`\`\`callout
title: 为什么需要这样配置？

这里包含 **重点**、[链接](https://example.com/) 和 \`inlineCode\`。

- 第一项
- 第二项
\`\`\``);

    expect(html).toMatch(/<details class="callout-card glass" data-callout-card(?:="")?>/);
    expect(html).toContain('<summary class="callout-card__summary">');
    expect(html).toContain('为什么需要这样配置？');
    expect(html).toContain('<div class="callout-card__content">');
    expect(html).toContain('<strong>重点</strong>');
    expect(html).toContain('<a href="https://example.com/">链接</a>');
    expect(html).toContain('<code>inlineCode</code>');
    expect(html).toContain('<li>第一项</li>');
    expect(html).not.toMatch(/<details[^>]*\sopen(?:\s|>|=)/);
  });

  it('renders fenced code inside the callout body', async () => {
    const html = await render(`~~~~callout
title: 代码示例

\`\`\`ts
const answer = 42;
\`\`\`
~~~~`);

    expect(html).toContain('class="language-ts"');
    expect(html).toContain('const answer = 42;');
  });

  it('escapes HTML in the title', async () => {
    const html = await render(`\`\`\`callout
title: <script>alert("x")</script>

安全正文。
\`\`\``);

    expect(html).toContain('&#x3C;script>alert("x")&#x3C;/script>');
    expect(html).not.toContain('<script>alert');
  });

  it('leaves unrelated code fences unchanged', async () => {
    const code = await render('```ts\nconst value = true;\n```');
    const clip = await render('```clip\ntitle: Example\n```');
    const reference = await render('```reference\ntitle: Example\n```');

    expect(code).not.toContain('data-callout-card');
    expect(clip).not.toContain('data-callout-card');
    expect(reference).not.toContain('data-callout-card');
  });

  it.each([
    ['missing title', '```callout\n正文内容。\n```', 'first line must use the "title: value" format'],
    ['empty title', '```callout\ntitle:   \n\n正文内容。\n```', 'Callout title must not be empty'],
    ['missing body', '```callout\ntitle: 只有标题\n```', 'Callout body is required'],
    ['blank body', '```callout\ntitle: 只有标题\n\n   \n```', 'Callout body is required'],
  ])('rejects %s', async (_name, markdown, message) => {
    await expect(render(markdown)).rejects.toThrow(message);
  });
});