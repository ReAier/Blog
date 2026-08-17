export interface ImageMarkdownInput {
  alt: string;
  path: string;
  title?: string;
}

export function createImageMarkdown(input: ImageMarkdownInput) {
  const alt = input.alt.replaceAll('\\', '\\\\').replaceAll('[', '\\[').replaceAll(']', '\\]');
  const path = input.path.replaceAll('(', '%28').replaceAll(')', '%29');
  const title = input.title?.trim().replaceAll('\\', '\\\\').replaceAll('"', '\\"');
  return `![${alt}](${path}${title ? ` "${title}"` : ''})`;
}

export function normalizeManagedImagePath(value?: string) {
  if (!value) return '';
  return value
    .replaceAll('\\', '/')
    .replace(/^\.\.\/images\//, '')
    .replace(/^\.\//, '')
    .replace(/^\/media\//, '')
    .replace(/^images\//, '')
    .replace(/^\//, '');
}

export function imageAssetMatchesPath(asset: { markdownPath: string; relativePath?: string; url: string }, value?: string) {
  const target = normalizeManagedImagePath(value);
  return Boolean(target) && [asset.markdownPath, asset.relativePath, asset.url].some((path) => normalizeManagedImagePath(path) === target);
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
