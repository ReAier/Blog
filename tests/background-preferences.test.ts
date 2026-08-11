import { describe, expect, it } from 'vitest';
import {
  BACKGROUND_PRESETS,
  DEFAULT_BACKGROUND,
  isBackground,
} from '../src/lib/preferences';

describe('background preferences', () => {
  it('defines image and adaptive solid presets while keeping the existing default', () => {
    expect(DEFAULT_BACKGROUND).toBe('default');
    expect(BACKGROUND_PRESETS).toEqual([
      { name: 'default', label: '背景一', kind: 'image', src: '/site-background.webp' },
      { name: 'background-2', label: '背景二', kind: 'image', src: '/site-background-2.webp' },
      { name: 'background-3', label: '背景三', kind: 'image', src: '/site-background-3.webp' },
      { name: 'warm-rice', label: '暖米', kind: 'solid', lightColor: '#EEE8DC', darkColor: '#24211C' },
      { name: 'mist-gray', label: '雾灰', kind: 'solid', lightColor: '#E4E6E5', darkColor: '#202322' },
      { name: 'sage', label: '鼠尾草', kind: 'solid', lightColor: '#DDE5D8', darkColor: '#1E261F' },
      { name: 'morning-blue', label: '晨雾蓝', kind: 'solid', lightColor: '#DCE5E9', darkColor: '#1D2428' },
      { name: 'lotus-pink', label: '藕粉', kind: 'solid', lightColor: '#E8DDE0', darkColor: '#282024' },
    ]);
  });

  it('accepts configured backgrounds and rejects unknown values', () => {
    for (const background of BACKGROUND_PRESETS) expect(isBackground(background.name)).toBe(true);
    expect(isBackground('background-4')).toBe(false);
    expect(isBackground(null)).toBe(false);
  });
});
