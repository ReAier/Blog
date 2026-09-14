import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const clientRoot = join(process.cwd(), 'admin', 'client', 'src');
const read = (path: string) => readFile(join(clientRoot, path), 'utf8');
const readProjectFile = (path: string) => readFile(join(process.cwd(), path), 'utf8');

describe('admin blog-visual shell contract', () => {
  it('keeps every workspace destination in a blog-style top navigation', async () => {
    const shell = await read('components/AppShell.tsx');

    expect(shell).toContain('className="admin-header site-header"');
    expect(shell).toContain('className="admin-nav site-nav"');
    expect(shell).toContain('className="admin-wordmark site-mark"');
    expect(shell).toContain('className="admin-header-inner nav-shell glass"');
    expect(shell).not.toContain('className="sidebar"');
    expect(shell).not.toContain('<aside className="sidebar"');
    expect(shell).toContain('aria-label="设置"');
    for (const label of ['工作台', '文章', '剪切板', '图片库', '发布与日志']) {
      expect(shell).toContain(label);
    }
  });

  it('places navigation above editor panes and preview iframes', async () => {
    const [css, sharedHeader] = await Promise.all([
      read('styles.css'),
      readProjectFile('src/styles/site-header.css'),
    ]);

    expect(sharedHeader).toMatch(/\.site-header\s*\{[^}]*position:\s*fixed;/s);
    expect(css).toMatch(/\.admin-header\s*\{[^}]*z-index:\s*200;/s);
    expect(css).not.toMatch(/\.workspace-main\s*\{[^}]*isolation:\s*isolate;/s);
    expect(css).toMatch(/\.editor-page\s*\{[^}]*position:\s*relative;[^}]*z-index:\s*0;/s);
    expect(css).toMatch(/\.preview-panel iframe\s*\{[^}]*position:\s*relative;[^}]*z-index:\s*0;/s);
  });
});

describe('admin readability contract', () => {
  it('defines distinct light and dark semantic surface tokens', async () => {
    const [entryCss, themeCss] = await Promise.all([read('styles.css'), read('styles/theme.css')]);
    const css = `${entryCss}
${themeCss}`;

    expect(entryCss.trimStart()).toMatch(/^@import '\.\.\/\.\.\/\.\.\/src\/styles\/glass-material\.css';\r?\n@import '\.\.\/\.\.\/\.\.\/src\/styles\/site-header\.css';\r?\n@import '\.\/styles\/theme\.css';/);
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


  it('reuses the public article-list glass material instead of approximating it', async () => {
    const [styles, publicStyles, sharedGlass] = await Promise.all([
      read('styles.css'),
      read('../../../src/styles/global.css'),
      read('../../../src/styles/glass-material.css'),
    ]);

    expect(styles.trimStart().startsWith("@import '../../../src/styles/glass-material.css';")).toBe(true);
    expect(publicStyles.trimStart().startsWith("@import './glass-material.css';")).toBe(true);
    expect(sharedGlass).toContain('--article-glass-surface: rgba(16, 18, 20, .48);');
    expect(sharedGlass).toContain('--article-glass-blur: 16px;');
    expect(sharedGlass).toContain('--article-glass-saturation: 125%;');
    expect(publicStyles).toMatch(/\.post-list\s*\{[^}]*background:\s*var\(--article-glass-surface\)[^}]*backdrop-filter:\s*blur\(var\(--article-glass-blur\)\) saturate\(var\(--article-glass-saturation\)\)/s);
    expect(styles).toMatch(/\.paper-card,[\s\S]*?\.setup-card[\s\S]*?\{[^}]*background:\s*var\(--article-glass-surface\)[^}]*backdrop-filter:\s*blur\(var\(--article-glass-blur\)\) saturate\(var\(--article-glass-saturation\)\)/s);
    expect(styles).not.toMatch(/\.workspace-main\s*\{[^}]*isolation:\s*isolate/s);
  });

  it('does not put glass panels inside an animated transform layer', async () => {
    const styles = await read('styles.css');

    expect(styles).not.toMatch(/\.page-stack\s*\{[^}]*animation:/s);
    expect(styles).not.toMatch(/\.editor-page\s*\{[^}]*animation:/s);
    expect(styles).not.toContain('@keyframes page-in');
  });

  it('keeps nested controls translucent without stacking full-panel blur', async () => {
    const styles = await read('styles.css');

    expect(styles).toMatch(/\.field input,[\s\S]*?\.blog-select__trigger[\s\S]*?\{[^}]*background:\s*var\(--glass-control\)/s);
    expect(styles).toMatch(/\.editor-grid,\s*\.clip-editor-grid\s*\{[^}]*background:\s*transparent;[^}]*isolation:\s*auto/s);
  });
  it('uses the shared glass material for article and clip editor panes', async () => {
    const styles = await read('styles.css');

    const sharedRule = styles.match(/\.page-header,[\s\S]*?\.preview-panel\s*\{[\s\S]*?\}/)?.[0] ?? '';
    expect(sharedRule).toContain('.editor-topline,');
    expect(sharedRule).toContain('.frontmatter-panel,');
    expect(sharedRule).toContain('.writing-panel,');
    expect(sharedRule).toContain('.security-intro,');
    expect(sharedRule).toContain('.security-form-card,');
    expect(sharedRule).toContain('.security-list-card,');
    expect(sharedRule).toContain('.editorial-resource-list,');
    expect(sharedRule).toContain('.preview-panel {');
    expect(sharedRule).toContain('background: var(--article-glass-surface);');
    expect(styles).not.toContain('background: var(--editor-glass-surface);');
    expect(styles).toMatch(/\.writing-toolbar,\s*\.preview-panel \.writing-toolbar,\s*\.editor-foot\s*\{\s*background:\s*transparent;/s);
    expect(styles).not.toMatch(/\.preview-panel \.writing-toolbar\s*\{[^}]*background:\s*var\(--toolbar-surface\)/s);
    expect(styles).toMatch(/@supports not[\s\S]*?\.frontmatter-panel,[\s\S]*?\.writing-panel,[\s\S]*?\.preview-panel \{ background: var\(--article-glass-surface-fallback\); \}/s);
  });
  it('keeps editor chrome transparent and scrolls inside fixed workspaces', async () => {
    const [styles, editor] = await Promise.all([
      read('styles.css'),
      read('components/MarkdownEditor.tsx'),
    ]);

    expect(styles).toMatch(/\.editor-grid\s*\{[^}]*grid-template-rows:\s*auto 620px/s);
    expect(styles).toMatch(/\.clip-editor-grid\s*\{[^}]*grid-template-rows:\s*auto 620px/s);
    expect(styles).toMatch(/\.editor-grid > \.writing-panel,[\s\S]*?\.clip-editor-grid > \.writing-panel\s*\{[^}]*min-height:\s*0[^}]*overflow:\s*hidden/s);
    expect(styles).toMatch(/\.writing-panel \.cm-scroller\s*\{[^}]*overflow:\s*auto/s);
    expect(styles).toMatch(/\.preview-panel iframe\s*\{[^}]*min-height:\s*0[^}]*overflow:\s*auto/s);
    expect(styles).toMatch(/\.editor-grid,\s*\.clip-editor-grid\s*\{[^}]*background:\s*transparent[^}]*box-shadow:\s*none[^}]*backdrop-filter:\s*none/s);
    expect(editor).toMatch(/'\.cm-gutters':\s*\{[^}]*backgroundColor:\s*'transparent'/s);
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

  it('gives statistic links a floating focus treatment with reduced-motion support', async () => {
    const styles = await read('styles.css');

    expect(styles).toMatch(/\.stat-grid\s*\{\s*overflow:\s*visible;/);
    expect(styles).toMatch(/\.stat-card\s*\{[^}]*text-decoration:\s*none[^}]*transition:\s*transform 220ms/s);
    expect(styles).toMatch(/\.stat-card:hover[\s\S]*transform:\s*translateY\(-6px\)/);
    expect(styles).toMatch(/\.stat-card:focus-visible[\s\S]*outline:\s*2px solid/);
    expect(styles).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*\.stat-card[\s\S]*transition:\s*none[\s\S]*transform:\s*none/);
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



describe('admin modal frosted glass contract', () => {
  it('reuses the established card glass material without an opaque or pre-blurred scrim', async () => {
    const [styles, confirm, images, clips, pickers] = await Promise.all([
      read('styles.css'),
      read('context/ConfirmDialogContext.tsx'),
      read('pages/ImagesPage.tsx'),
      read('components/ClipImportDialog.tsx'),
      read('components/PostMetadataPickers.tsx'),
    ]);

    const redesign = styles.slice(styles.indexOf('/* Dialog system: clear glass sheets */'));
    expect(redesign).toContain('background: var(--article-glass-surface);');
    expect(redesign).toContain('blur(var(--article-glass-blur)) saturate(var(--article-glass-saturation))');
    expect(redesign).toMatch(/\.dialog-scrim\s*\{[^}]*background:\s*rgba\(5, 7, 9, \.28\);[^}]*-webkit-backdrop-filter:\s*none;[^}]*backdrop-filter:\s*none;/s);
    expect(redesign).toMatch(/\.picker-dialog\s*\{[^}]*border:\s*1px solid var\(--glass-border-strong\);[^}]*border-radius:\s*18px;/s);
    expect(redesign).not.toContain('radial-gradient(');
    expect(redesign).not.toContain('.picker-dialog::before');
    expect(redesign).not.toContain('.picker-dialog::after');
    expect(redesign).toMatch(/\.confirm-dialog\s*\{[^}]*width:\s*min\(620px,/s);
    expect(redesign).toContain('.confirm-dialog__content');
    expect(redesign).not.toContain('.confirm-dialog__index');
    expect(redesign).not.toContain('.confirm-dialog__mark');
    expect(confirm).toContain('className="confirm-dialog__content"');
    expect(confirm).not.toContain('confirm-dialog__index');
    expect(confirm).not.toContain('confirm-dialog__mark');
    expect(styles).toMatch(/@supports not[\s\S]*?\.picker-dialog[\s\S]*?var\(--article-glass-surface-fallback\)/s);
    expect(styles).toContain('.appearance-panel {');

    for (const source of [confirm, images, clips, pickers]) {
      expect(source).toContain('<Dialog');
    }
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


describe('admin glass material reuse', () => {
  it('routes every post and Clip editor section through the same topline glass rule', async () => {
    const [styles, postEditor, clipEditor] = await Promise.all([
      read('styles.css'),
      read('pages/PostEditorPage.tsx'),
      read('pages/ClipEditorPage.tsx'),
    ]);

    const sharedRule = styles.match(/\.page-header,[\s\S]*?\.preview-panel\s*\{[\s\S]*?\}/)?.[0] ?? '';
    expect(sharedRule).toContain('.editor-topline,');
    expect(sharedRule).toContain('.frontmatter-panel,');
    expect(sharedRule).toContain('.writing-panel,');
    expect(sharedRule).toContain('.security-intro,');
    expect(sharedRule).toContain('.security-form-card,');
    expect(sharedRule).toContain('.security-list-card,');
    expect(sharedRule).toContain('.editorial-resource-list,');
    expect(sharedRule).toContain('.preview-panel {');
    expect(styles).not.toContain('background: var(--editor-glass-surface);');
    expect(styles).toMatch(/\.writing-toolbar,\s*\.preview-panel \.writing-toolbar,\s*\.editor-foot\s*\{\s*background:\s*transparent;/s);
    expect(styles).not.toMatch(/\.preview-panel \.writing-toolbar\s*\{[^}]*background:\s*var\(--toolbar-surface\)/s);
    expect(postEditor).toContain('observePreviewTheme(document.documentElement');
    expect(clipEditor).toContain('className="frontmatter-panel compact-info-panel"');
  });
});

describe('shared public and admin site header', () => {
  it('loads one header stylesheet from both visual entry points', async () => {
    const publicCss = await readProjectFile('src/styles/global.css');
    const adminCss = await read('styles.css');

    expect(publicCss).toContain("@import './site-header.css';");
    expect(adminCss).toContain("@import '../../../src/styles/site-header.css';");
  });

  it('defines the shared shell, navigation indicator, controls, and mobile contract', async () => {
    const css = await readProjectFile('src/styles/site-header.css');

    expect(css).toContain('.site-header');
    expect(css).toContain('.nav-shell');
    expect(css).toContain('.nav-shell.glass');
    expect(css).toContain('.site-mark');
    expect(css).toContain('.site-nav');
    expect(css).toContain('.nav-indicator');
    expect(css).toContain('.header-actions');
    expect(css).toContain('.icon-button');
    expect(css).toContain('@media (max-width: 760px)');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
  });

  it('keeps the admin header on the exact public material and indicator geometry', async () => {
    const [sharedHeader, adminCss] = await Promise.all([
      readProjectFile('src/styles/site-header.css'),
      read('styles.css'),
    ]);

    expect(sharedHeader).toContain('--site-header-surface: rgba(255, 254, 250, .78);');
    expect(sharedHeader).toContain('--site-header-surface: rgba(20, 22, 24, .72);');
    expect(sharedHeader).toContain('background: var(--site-header-surface);');
    expect(sharedHeader).toContain('box-shadow: var(--site-header-shadow);');
    expect(adminCss).not.toContain('--site-header-content: 1440px');
    expect(adminCss).not.toContain(".nav-item::after { content: ''; position: absolute; left: -13px; width: 3px;");
    expect(adminCss).toMatch(/\.admin-nav \.nav-item::after\s*\{[^}]*width:\s*auto;/s);
  });
  it('uses the shared class contract without removing admin behavior', async () => {
    const shell = await read('components/AppShell.tsx');
    const appearance = await read('components/AppearanceControls.tsx');

    expect(shell).toContain('className="admin-header site-header"');
    expect(shell).toContain('className="admin-header-inner nav-shell glass"');
    expect(shell).toContain('className="admin-wordmark site-mark"');
    expect(shell).toContain('className="admin-nav site-nav"');
    expect(shell).toContain('className="admin-utilities header-actions"');
    expect(shell).toContain('aria-label="设置"');
    expect(shell).toContain('hasPermission(item.permission)');
    expect(appearance).toContain('className="appearance-trigger icon-button"');
  });
});
