import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const clientRoot = join(process.cwd(), 'admin', 'client', 'src');
const read = (path: string) => readFile(join(clientRoot, path), 'utf8');

function themeBlock(css: string, selector: string): string {
  const start = css.indexOf(selector);
  if (start < 0) return '';
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  return css.slice(open + 1, close);
}

describe('admin light theme surface contract', () => {
  it('defines every adaptive surface token in both themes', async () => {
    const css = await read('styles/theme.css');
    const light = themeBlock(css, ":root,\n:root[data-theme='light']");
    const dark = themeBlock(css, ":root[data-theme='dark']");

    for (const token of [
      '--surface-soft',
      '--surface-strong',
      '--button-surface',
      '--notice-surface',
      '--danger-surface',
      '--status-surface',
      '--tag-surface',
      '--editor-shell-surface',
      '--frontmatter-surface',
    ]) {
      expect(light).toContain(`${token}:`);
      expect(dark).toContain(`${token}:`);
    }
  });

  it('uses semantic surfaces for light-sensitive admin components', async () => {
    const css = await read('styles.css');

    for (const declaration of [
      'background: var(--button-surface);',
      'background: var(--notice-surface);',
      'background: var(--danger-surface);',
      'background: var(--status-surface);',
      'background: var(--tag-surface);',
      'background: var(--editor-shell-surface);',
      'background: var(--frontmatter-surface);',
      'background: var(--input-surface);',
    ]) expect(css).toContain(declaration);

    for (const forcedDark of [
      'background: rgba(18, 21, 23, .88);',
      'background: rgba(16, 19, 21, .94);',
      'background: rgba(16, 19, 21, .66);',
      'background: rgba(20, 21, 25, .88);',
      'background: rgba(20, 21, 25, .94);',
      'background: rgba(16, 19, 21, .92);',
      'background: rgba(10, 13, 15, .91);',
      'background: rgba(17, 20, 22, .92);',
      'background: rgba(7, 10, 12, .78);',
      'background: rgba(16, 19, 21, .98);',
      'background: rgba(77, 28, 25, .96);',
    ]) expect(css).not.toContain(forcedDark);

    expect(css).not.toContain('.switch-row input { background: #555b60; }');
  });

  it('keeps terminal output intentionally dark through its semantic token', async () => {
    const css = await read('styles.css');

    expect(css).toMatch(/\.terminal-card\s*\{[^}]*background:\s*var\(--terminal-surface\)/s);
    expect(css).toMatch(/\.compare-columns pre\s*\{[^}]*background:\s*var\(--terminal-surface\)/s);
  });
  it('keeps selected appearance buttons readable in both themes', async () => {
    const [themeCss, css] = await Promise.all([
      read('styles/theme.css'),
      read('styles.css'),
    ]);
    const light = themeBlock(themeCss, ":root,\n:root[data-theme='light']");
    const dark = themeBlock(themeCss, ":root[data-theme='dark']");

    for (const token of ['--choice-active-surface', '--choice-active-text']) {
      expect(light).toContain(`${token}:`);
      expect(dark).toContain(`${token}:`);
    }
    expect(css).toMatch(/\.appearance-choice\s*\{[^}]*background:\s*var\(--button-surface\)/s);
    expect(css).toMatch(/\.appearance-choice\[aria-pressed='true'\]\s*\{[^}]*color:\s*var\(--choice-active-text\)[^}]*background:\s*var\(--choice-active-surface\)/s);
    expect(css).not.toContain(".appearance-choice[aria-pressed='true'] { color: #fff; }");
    expect(css).not.toMatch(/\.appearance-choice\s*\{[^}]*background:\s*rgba\(255, 255, 255, \.045\)/s);
  });

});
