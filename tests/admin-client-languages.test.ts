import { describe, expect, it } from 'vitest';
import {
  CLIP_LANGUAGE_OPTIONS,
  clipLanguageLabel,
  clipLanguageOptions,
} from '../admin/client/src/lib/languages';

describe('admin clip language options', () => {
  it('only offers languages backed by the admin editor', () => {
    expect(CLIP_LANGUAGE_OPTIONS).toEqual([
      { value: 'text', label: '纯文本' },
      { value: 'typescript', label: 'TypeScript' },
      { value: 'javascript', label: 'JavaScript' },
      { value: 'tsx', label: 'TSX' },
      { value: 'jsx', label: 'JSX' },
      { value: 'python', label: 'Python' },
      { value: 'cpp', label: 'C / C++' },
    ]);
  });

  it('preserves an existing legacy language without offering it for new clips', () => {
    expect(clipLanguageOptions('rust')[0]).toEqual({
      value: 'rust',
      label: 'rust（旧内容）',
    });
    expect(clipLanguageOptions().some((option) => option.value === 'rust')).toBe(false);
    expect(clipLanguageLabel('cpp')).toBe('C / C++');
    expect(clipLanguageLabel('rust')).toBe('rust');
  });
});
