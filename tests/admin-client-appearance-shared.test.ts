// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  accents,
  backgrounds,
  initializeAppearance,
  saveAppearance,
} from '../admin/client/src/lib/preferences';
import { ACCENTS, BACKGROUND_PRESETS } from '../src/lib/preferences';

afterEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.removeAttribute('data-theme-choice');
  vi.unstubAllGlobals();
});

describe('shared admin appearance configuration', () => {
  it('uses the exact public accent and background definitions', () => {
    expect(accents).toBe(ACCENTS);
    expect(backgrounds).toBe(BACKGROUND_PRESETS);
  });

  it('updates a system theme choice when the operating-system preference changes', () => {
    let listener: ((event: MediaQueryListEvent) => void) | undefined;
    const media = {
      matches: false,
      addEventListener: vi.fn((_name: string, callback: (event: MediaQueryListEvent) => void) => {
        listener = callback;
      }),
      removeEventListener: vi.fn(),
    };
    vi.stubGlobal('matchMedia', vi.fn(() => media));

    const dispose = initializeAppearance();
    expect(document.documentElement.dataset.theme).toBe('light');

    media.matches = true;
    listener?.({ matches: true } as MediaQueryListEvent);
    expect(document.documentElement.dataset.theme).toBe('dark');

    saveAppearance('light', 'rose', 'default');
    listener?.({ matches: true } as MediaQueryListEvent);
    expect(document.documentElement.dataset.theme).toBe('light');
    dispose();
  });
});
