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

export function clipLanguageLabel(value: string): string {
  return CLIP_LANGUAGE_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

export function clipLanguageOptions(current?: string): ClipLanguageOption[] {
  return current && !CLIP_LANGUAGE_OPTIONS.some((option) => option.value === current)
    ? [{ value: current, label: `${current}（旧内容）` }, ...CLIP_LANGUAGE_OPTIONS]
    : [...CLIP_LANGUAGE_OPTIONS];
}
