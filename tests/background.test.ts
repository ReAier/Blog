import { access, readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const root = new URL('../', import.meta.url);

describe('selectable backgrounds', () => {
  it.each([
    'site-background.webp',
    'site-background-2.webp',
    'site-background-3.webp',
  ])('ships optimized background asset %s', async (file) => {
    await expect(access(new URL(`public/${file}`, root))).resolves.toBeUndefined();
  });

  it('maps all three image preferences and keeps theme overlays', async () => {
    const css = await readFile(new URL('src/styles/global.css', root), 'utf8');
    expect(css).toContain(":root[data-background='default']");
    expect(css).toContain("url('/site-background.webp')");
    expect(css).toContain(":root[data-background='background-2']");
    expect(css).toContain("url('/site-background-2.webp')");
    expect(css).toContain(":root[data-background='background-3']");
    expect(css).toContain("url('/site-background-3.webp')");
    expect(css).toContain('--backdrop-overlay:');
    expect(css).toContain(':root[data-theme="dark"]');
    expect(css).toContain('background-image: var(--backdrop-overlay), var(--page-background)');
  });

  it('maps every solid preference to approved light and dark colors', async () => {
    const css = await readFile(new URL('src/styles/global.css', root), 'utf8');
    const solidBackgrounds = [
      ['warm-rice', '#EEE8DC', '#24211C'],
      ['mist-gray', '#E4E6E5', '#202322'],
      ['sage', '#DDE5D8', '#1E261F'],
      ['morning-blue', '#DCE5E9', '#1D2428'],
      ['lotus-pink', '#E8DDE0', '#282024'],
    ] as const;

    for (const [name, lightColor, darkColor] of solidBackgrounds) {
      expect(css).toContain(`:root[data-background='${name}']`);
      expect(css).toContain(`linear-gradient(${lightColor}, ${lightColor})`);
      expect(css).toContain(`:root[data-theme="dark"][data-background='${name}']`);
      expect(css).toContain(`linear-gradient(${darkColor}, ${darkColor})`);
    }
  });

  it('restores and persists a versioned background preference', async () => {
    const layout = await readFile(new URL('src/layouts/BaseLayout.astro', root), 'utf8');
    const panel = await readFile(new URL('src/components/PreferencePanel.astro', root), 'utf8');
    const css = await readFile(new URL('src/styles/global.css', root), 'utf8');
    expect(layout).toContain('data-background="default"');
    expect(layout).toContain('aier-background-v1');
    expect(panel).toContain('aier-background-v1');
    expect(panel).toContain('background: root.dataset.background');
    expect(panel).toContain('data-background-kind={background.kind}');
    expect(panel).toContain('--background-thumbnail-light');
    expect(panel).toContain('--background-thumbnail-dark');
    expect(panel).toContain("background.kind === 'image'");
    expect(css).toContain(':root[data-theme="dark"] .background-choice');
    expect(css).toContain('--background-thumbnail: var(--background-thumbnail-dark)');
  });
});
