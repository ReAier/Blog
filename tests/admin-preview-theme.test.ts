// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { observePreviewTheme } from '../admin/client/src/lib/preview';

describe('admin preview theme synchronization', () => {
  it('observes live appearance changes for an already-rendered preview', async () => {
    const root = document.documentElement;
    root.dataset.theme = 'dark';
    root.dataset.accent = 'rose';
    root.dataset.background = 'default';
    let currentTheme: unknown;
    const stop = observePreviewTheme(root, (theme) => {
      currentTheme = theme;
    });

    root.dataset.theme = 'light';
    root.dataset.accent = 'teal';
    root.dataset.background = 'mist-gray';
    await new Promise((resolve) => window.setTimeout(resolve, 0));

    expect(currentTheme).toEqual({
      theme: 'light',
      accent: 'teal',
      background: 'mist-gray',
    });
    stop();
  });
});
