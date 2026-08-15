import { describe, expect, it } from 'vitest';
import {
  normalizeAccent,
  normalizeBackground,
  resolveTheme,
} from '../admin/client/src/lib/preferences';

describe('admin appearance preferences', () => {
  it('uses the public blog preference vocabulary and safe fallbacks', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('invalid', false)).toBe('light');
    expect(normalizeAccent('teal')).toBe('teal');
    expect(normalizeAccent('purple')).toBe('rose');
    expect(normalizeBackground('background-3')).toBe('background-3');
    expect(normalizeBackground('../secret')).toBe('default');
  });
});
