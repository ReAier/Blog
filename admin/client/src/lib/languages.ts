export interface ClipLanguageOption {
  value: string;
  label: string;
}

export const CLIP_LANGUAGE_OPTIONS: ClipLanguageOption[] = [
  { value: 'text', label: '纯文本' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'tsx', label: 'TSX' },
  { value: 'jsx', label: 'JSX' },
  { value: 'python', label: 'Python' },
  { value: 'cpp', label: 'C / C++' },
];

const CLIP_LANGUAGE_BY_EXTENSION: Readonly<Record<string, string>> = {
  '.txt': 'text',
  '.ts': 'typescript',
  '.js': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.tsx': 'tsx',
  '.jsx': 'jsx',
  '.py': 'python',
  '.c': 'cpp',
  '.h': 'cpp',
  '.cc': 'cpp',
  '.cpp': 'cpp',
  '.cxx': 'cpp',
  '.hpp': 'cpp',
  '.hxx': 'cpp',
};

export const CLIP_IMPORT_ACCEPT = Object.keys(CLIP_LANGUAGE_BY_EXTENSION).join(',');

export function detectClipLanguage(filename: string): string | undefined {
  const extension = /\.[^.]+$/.exec(filename.trim())?.[0].toLowerCase();
  return extension ? CLIP_LANGUAGE_BY_EXTENSION[extension] : undefined;
}

export function clipLanguageLabel(value: string): string {
  return CLIP_LANGUAGE_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

export function clipLanguageOptions(current?: string): ClipLanguageOption[] {
  return current && !CLIP_LANGUAGE_OPTIONS.some((option) => option.value === current)
    ? [{ value: current, label: `${current}（旧内容）` }, ...CLIP_LANGUAGE_OPTIONS]
    : [...CLIP_LANGUAGE_OPTIONS];
}
