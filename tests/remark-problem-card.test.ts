import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import { describe, expect, it } from 'vitest';
import { remarkProblemCards } from '../src/lib/remark-problem-card';

async function render(markdown: string) {
  const processor = await createMarkdownProcessor({
    syntaxHighlight: false,
    smartypants: false,
    remarkPlugins: [remarkProblemCards],
  });
  return (await processor.render(markdown)).code;
}

const completeFence = `code: LIS
title: Longest Increasing Subsequence
url: https://example.com/problems/lis?source=blog&lang=zh
difficulty: orange
categories: dynamic programming, binary search, dynamic programming`;

describe('remark problem cards', () => {
  it('renders a complete problem card with normalized categories', async () => {
    const html = await render(`\`\`\`problem\n` + completeFence + `\n\`\`\``);

    expect(html).toContain('class="problem-card glass"');
    expect(html).toContain('data-problem-card');
    expect(html).toContain('data-difficulty="orange"');
    expect(html).toContain('Longest Increasing Subsequence');
    expect(html.match(/dynamic programming/g)).toHaveLength(1);
    expect(html).toContain('binary search');
    expect(html.match(/href="https:\/\/example\.com\/problems\/lis\?source=blog(?:&amp;|&#x26;)lang=zh"/g)).toHaveLength(2);
    expect(html).toContain('class="problem-card__platform"');
    expect(html).toContain('example.com');
    expect(html).toContain('class="problem-card__title-link"');
    expect(html).toContain('class="problem-card__watermark" aria-hidden="true">LIS</span>');
    expect(html.indexOf('problem-card__platform')).toBeLessThan(html.indexOf('problem-card__title'));
    expect(html.indexOf('problem-card__title')).toBeLessThan(html.indexOf('problem-card__categories'));
    expect(html).not.toContain('problem-card__action');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('renders an explicit AtCoder problem code separately from the title', async () => {
    const html = await render(`\`\`\`problem
code: AT_DP_O
title: Matching
url: https://atcoder.jp/contests/dp/tasks/dp_o
difficulty: green
categories: dynamic programming
\`\`\``);

    expect(html).toContain('>Matching</a>');
    expect(html).not.toContain('>AT_DP_O Matching</a>');
    expect(html).toContain('ATCODER');
    expect(html).toContain('class="problem-card__watermark" aria-hidden="true">AT_DP_O</span>');
  });

  it.each(['red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'black'])('supports the %s difficulty', async (difficulty) => {
    const html = await render(`\`\`\`problem
code: EXAMPLE
title: Example
url: https://example.com/problem
difficulty: ` + difficulty + `
categories: algorithm
\`\`\``);
    expect(html).toContain(`data-difficulty="` + difficulty + `"`);
  });

  it('escapes code, title and categories', async () => {
    const html = await render(`\`\`\`problem
code: <CODE>
title: <script>alert("x")</script>
url: https://example.com/problem
difficulty: purple
categories: A & B, <img src=x>
\`\`\``);

    expect(html).toContain('&#x3C;CODE>');
    expect(html).toContain('&#x3C;script>alert("x")&#x3C;/script>');
    expect(html).toContain('A &#x26; B');
    expect(html).toContain('&#x3C;img src=x>');
    expect(html).not.toContain('<script>alert');
    expect(html).not.toContain('<img src=x>');
  });

  it('leaves unrelated fences unchanged', async () => {
    for (const language of ['ts', 'clip', 'reference', 'callout']) {
      const html = await render(`\`\`` + language + `\ncode: EXAMPLE\ntitle: Example\n\`\`\``);
      expect(html).not.toContain('data-problem-card');
    }
  });

  it.each([
    ['missing code', 'title: Example\nurl: https://example.com\ndifficulty: red\ncategories: algorithm', 'code is required'],
    ['missing title', 'code: EXAMPLE\nurl: https://example.com\ndifficulty: red\ncategories: algorithm', 'title is required'],
    ['missing URL', 'code: EXAMPLE\ntitle: Example\ndifficulty: red\ncategories: algorithm', 'url is required'],
    ['relative URL', 'code: EXAMPLE\ntitle: Example\nurl: /problem\ndifficulty: red\ncategories: algorithm', 'absolute http or https URL'],
    ['unsupported protocol', 'code: EXAMPLE\ntitle: Example\nurl: javascript:alert(1)\ndifficulty: red\ncategories: algorithm', 'absolute http or https URL'],
    ['missing difficulty', 'code: EXAMPLE\ntitle: Example\nurl: https://example.com\ncategories: algorithm', 'difficulty is required'],
    ['invalid difficulty', 'code: EXAMPLE\ntitle: Example\nurl: https://example.com\ndifficulty: pink\ncategories: algorithm', 'must be one of'],
    ['missing categories', 'code: EXAMPLE\ntitle: Example\nurl: https://example.com\ndifficulty: red', 'categories is required'],
    ['empty categories', 'code: EXAMPLE\ntitle: Example\nurl: https://example.com\ndifficulty: red\ncategories: ,', 'at least one category'],
    ['duplicate field', 'code: EXAMPLE\ntitle: One\ntitle: Two\nurl: https://example.com\ndifficulty: red\ncategories: algorithm', 'Duplicate problem field "title"'],
    ['unknown field', 'code: EXAMPLE\ntitle: Example\nurl: https://example.com\ndifficulty: red\ncategories: algorithm\nauthor: Aier', 'Unknown problem field "author"'],
    ['malformed line', 'code: EXAMPLE\ntitle Example\nurl: https://example.com\ndifficulty: red\ncategories: algorithm', 'key: value'],
    ['empty value', 'code:\ntitle: Example\nurl: https://example.com\ndifficulty: red\ncategories: algorithm', 'code must not be empty'],
  ])('rejects %s', async (_label, definition, message) => {
    await expect(render(`\`\`\`problem\n` + definition + `\n\`\`\``)).rejects.toThrow(message);
  });
});
