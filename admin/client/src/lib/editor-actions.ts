export interface ClipFenceInput {
  title: string;
  description: string;
  language: string;
  file: string;
  createdAt: string;
}

export interface ImageMarkdownInput {
  alt: string;
  path: string;
  title?: string;
}

function cleanLine(value: string) {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

export function createClipFence(input: ClipFenceInput) {
  return [
    '```clip',
    `title: ${cleanLine(input.title)}`,
    `description: ${cleanLine(input.description)}`,
    `language: ${cleanLine(input.language)}`,
    `file: ${cleanLine(input.file)}`,
    `createdAt: ${cleanLine(input.createdAt)}`,
    '```',
  ].join('\n');
}

export function createImageMarkdown(input: ImageMarkdownInput) {
  const alt = input.alt.replaceAll('\\', '\\\\').replaceAll('[', '\\[').replaceAll(']', '\\]');
  const path = input.path.replaceAll('(', '%28').replaceAll(')', '%29');
  const title = input.title?.trim().replaceAll('\\', '\\\\').replaceAll('"', '\\"');
  return `![${alt}](${path}${title ? ` "${title}"` : ''})`;
}

export function isSaveShortcut(event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey'>) {
  return (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's';
}


export function normalizeCodeLanguage(value: string | undefined): string | undefined {
  const language = value?.trim().toLowerCase();
  if (!language) return undefined;
  const aliases: Record<string, string> = {
    c: 'cpp',
    'c++': 'cpp',
    cc: 'cpp',
    cxx: 'cpp',
    h: 'cpp',
    hpp: 'cpp',
    js: 'javascript',
    jsx: 'jsx',
    ts: 'typescript',
    tsx: 'tsx',
    py: 'python',
    py3: 'python',
    plaintext: 'text',
    plain: 'text',
  };
  return aliases[language] ?? language;
}
