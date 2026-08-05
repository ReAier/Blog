import { describe, expect, it } from 'vitest';
import {
  BACKGROUND_PRESETS,
  DEFAULT_BACKGROUND,
  isBackground,
} from '../src/lib/preferences';

describe('background preferences', () => {
  it('defines three fixed presets and uses the existing image by default', () => {
    expect(DEFAULT_BACKGROUND).toBe('default');
    expect(BACKGROUND_PRESETS).toEqual([
      { name: 'default', label: '背景一', src: '/site-background.webp' },
      { name: 'background-2', label: '背景二', src: '/site-background-2.webp' },
      { name: 'background-3', label: '背景三', src: '/site-background-3.webp' },
    ]);
  });

  it('accepts configured backgrounds and rejects unknown values', () => {
    for (const background of BACKGROUND_PRESETS) expect(isBackground(background.name)).toBe(true);
    expect(isBackground('background-4')).toBe(false);
    expect(isBackground(null)).toBe(false);
  });
});
