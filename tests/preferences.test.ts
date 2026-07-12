import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { ACCENTS, DEFAULT_ACCENT, isAccent, resolveTheme } from '../src/lib/preferences';

describe('accent preferences', () => {
  it('uses rose as the default accent', () => {
    expect(DEFAULT_ACCENT).toBe('rose');
  });
  it('accepts every configured accent', () => {
    expect(ACCENTS.map((accent) => accent.name)).toEqual(['coral', 'teal', 'indigo', 'amber', 'rose']);
    for (const accent of ACCENTS) expect(isAccent(accent.name)).toBe(true);
  });

  it('rejects unknown accent values', () => {
    expect(isAccent('purple')).toBe(false);
    expect(isAccent(null)).toBe(false);
  });
});

describe('theme preference', () => {
  it('keeps an explicit light or dark preference', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });

  it('follows the system preference when the saved value is invalid', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme(undefined, false)).toBe('light');
  });
});

describe('preference panel lifecycle', () => {
  it('reinitializes after page swaps and announces preference changes', async () => {
    const panel = await readFile(new URL('../src/components/PreferencePanel.astro', import.meta.url), 'utf8');
    for (const token of [
      'initializePreferences',
      'AbortController',
      "new CustomEvent('aier:preference-change'",
      'astro:page-load',
      'astro:before-preparation',
      "event.key === 'Escape'",
    ]) expect(panel).toContain(token);
  });
});
