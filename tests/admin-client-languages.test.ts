import { describe, expect, it } from 'vitest';
import {
  CLIP_IMPORT_ACCEPT,
  CLIP_LANGUAGE_OPTIONS,
  clipLanguageLabel,
  clipLanguageOptions,
  detectClipLanguage,
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

  it('maps every supported source extension to an editor language', () => {
    expect(CLIP_IMPORT_ACCEPT).toBe(
      '.txt,.ts,.js,.mjs,.cjs,.tsx,.jsx,.py,.c,.h,.cc,.cpp,.cxx,.hpp,.hxx',
    );
    expect([
      'notes.txt',
      'component.ts',
      'browser.js',
      'module.mjs',
      'config.cjs',
      'view.tsx',
      'widget.jsx',
      'script.py',
      'main.c',
      'header.h',
      'source.cc',
      'source.cpp',
      'source.cxx',
      'header.hpp',
      'header.hxx',
    ].map((filename) => detectClipLanguage(filename))).toEqual([
      'text',
      'typescript',
      'javascript',
      'javascript',
      'javascript',
      'tsx',
      'jsx',
      'python',
      'cpp',
      'cpp',
      'cpp',
      'cpp',
      'cpp',
      'cpp',
      'cpp',
    ]);
  });

  it('detects the final extension case-insensitively and rejects unsupported names', () => {
    expect(detectClipLanguage('archive.COMPONENT.TSX')).toBe('tsx');
    expect(detectClipLanguage('SCRIPT.Py')).toBe('python');
    expect(detectClipLanguage('README')).toBeUndefined();
    expect(detectClipLanguage('source.')).toBeUndefined();
    expect(detectClipLanguage('archive.zip')).toBeUndefined();
  });
});
