import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import { SHIKI_CONFIG } from './syntax-highlighting';

const processor = createMarkdownProcessor({
  syntaxHighlight: 'shiki',
  shikiConfig: SHIKI_CONFIG,
  smartypants: false,
});

function codeFenceFor(code: string): string {
  const runs = code.match(/`+/g) ?? [];
  const longest = runs.reduce((length, run) => Math.max(length, run.length), 0);
  return '`'.repeat(Math.max(3, longest + 1));
}

export async function highlightClipCode(code: string, language: string): Promise<string> {
  const fence = codeFenceFor(code);
  const markdown = `${fence}${language}\n${code}${code.endsWith('\n') ? '' : '\n'}${fence}`;
  const renderer = await processor;
  const result = await renderer.render(markdown);
  return result.code;
}
