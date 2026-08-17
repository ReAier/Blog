import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const clientRoot = join(process.cwd(), 'admin', 'client', 'src');
const read = (path: string) => readFile(join(clientRoot, path), 'utf8');

describe('admin blog-visual shell contract', () => {
  it('keeps every workspace destination in a blog-style top navigation', async () => {
    const shell = await read('components/AppShell.tsx');

    expect(shell).toContain('className="admin-header"');
    expect(shell).toContain('className="admin-nav"');
    expect(shell).toContain('className="admin-wordmark"');
    expect(shell).not.toContain('className="sidebar"');
    expect(shell).not.toContain('<aside className="sidebar"');
    expect(shell).toContain('aria-label="设置"');
    for (const label of ['工作台', '文章', '剪切板', '图片库', '发布与日志']) {
      expect(shell).toContain(label);
    }
  });

  it('places navigation above editor panes and preview iframes', async () => {
    const css = await read('styles.css');

    expect(css).toMatch(/\.admin-header\s*\{[^}]*position:\s*sticky;[^}]*z-index:\s*200;/s);
    expect(css).toMatch(/\.workspace-main\s*\{[^}]*isolation:\s*isolate;/s);
    expect(css).toMatch(/\.editor-page\s*\{[^}]*position:\s*relative;[^}]*z-index:\s*0;/s);
    expect(css).toMatch(/\.preview-panel iframe\s*\{[^}]*position:\s*relative;[^}]*z-index:\s*0;/s);
  });
});

describe('admin readability contract', () => {
  it('defines distinct light and dark semantic surface tokens', async () => {
    const [entryCss, themeCss] = await Promise.all([read('styles.css'), read('styles/theme.css')]);
    const css = `${entryCss}
${themeCss}`;

    expect(entryCss.trimStart().startsWith("@import './styles/theme.css';")).toBe(true);
    expect(css).toMatch(/:root,\s*:root\[data-theme='light'\]\s*\{[^}]*color-scheme:\s*light;/s);
    expect(css).toMatch(/:root\[data-theme='dark'\]\s*\{[^}]*color-scheme:\s*dark;/s);
    expect(css).not.toMatch(/:root,\s*:root\[data-theme='light'\],\s*:root\[data-theme='dark'\]\s*\{[^}]*color-scheme:\s*dark;/s);
    expect(css).toContain('--admin-canvas: #f4f1eb;');
    expect(css).toContain('--admin-canvas: #090c0e;');
    expect(css).toContain('--editor-surface: rgba(255, 254, 250, .92);');
    expect(css).toContain('--editor-surface: rgba(6, 9, 11, .68);');
    expect(css).toContain('backdrop-filter: blur(24px)');
    expect(css).toMatch(/input::placeholder[^{]*\{[^}]*color:\s*var\(--placeholder\)/s);
    expect(css).toMatch(/\.field input[^}]*color:\s*var\(--text\)/s);
    expect(css).toMatch(/\.data-table td[^}]*color:\s*var\(--muted\)/s);
  });

  it('uses semantic CodeMirror colors that follow the active theme', async () => {
    const editor = await read('components/MarkdownEditor.tsx');

    expect(editor).toContain("color: 'var(--editor-text)'");
    expect(editor).toContain("caretColor: 'var(--editor-caret)'");
    expect(editor).toContain("backgroundColor: 'var(--editor-selection)'");
    expect(editor).toContain("color: 'var(--editor-muted)'");
    expect(editor).not.toContain("}, { dark: true })");
  });
});

describe('admin dashboard composition', () => {
  it('omits independent-resource hygiene and editor note from the dashboard', async () => {
    const dashboard = await read('pages/DashboardPage.tsx');

    expect(dashboard).not.toContain('hygiene-card');
    expect(dashboard).not.toContain('Content hygiene');
    expect(dashboard).not.toContain("EDITOR'S NOTE");
  });
});

describe('compact metadata controls', () => {
  it('defines compact metadata controls and picker states', async () => {
    const css = await read('styles.css');

    for (const selector of [
      '.compact-action',
      '.metadata-picker',
      '.tag-control',
      '.selected-tags',
      '.cover-control',
      '.cover-preview',
      '.compact-info-panel',
      '.clip-import-dialog',
    ]) expect(css).toContain(selector);
    expect(css).toMatch(/\.editor-info-form\s*\{[^}]*gap:\s*(?:8|10|12)px/s);
  });
});


describe('admin settings menu visuals', () => {
  it('styles the compact settings trigger and anchored menu', async () => {
    const styles = await read('styles.css');

    expect(styles).toContain('.settings-control { position: relative; }');
    expect(styles).toContain('.settings-trigger');
    expect(styles).toContain('.settings-menu {');
    expect(styles).toContain('position: absolute;');
    expect(styles).toContain('right: 0;');
    expect(styles).toContain('.settings-menu-item.is-active');
    expect(styles).toContain('.settings-menu-divider');
  });
});
