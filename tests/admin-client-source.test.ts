import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const root = join(process.cwd(), 'admin', 'client');

async function source(relativePath: string) {
  try {
    return await readFile(join(root, relativePath), 'utf8');
  } catch {
    return '';
  }
}

describe('admin client source contract', () => {
  it('provides a Vite React SPA entry point and all required routes', async () => {
    const [indexHtml, main, app] = await Promise.all([
      source('index.html'),
      source('src/main.tsx'),
      source('src/App.tsx'),
    ]);

    expect(indexHtml).toContain('<div id="root"></div>');
    expect(main).toMatch(/createRoot\(.+\)\.render/);
    expect(app).toContain('createBrowserRouter');
    for (const route of [
      '/login',
      '/setup',
      '/posts',
      '/posts/:slug',
      '/clips',
      '/clips/:slug',
      '/images',
      '/backups',
      '/publish',
    ]) {
      expect(app).toContain(`path: '${route}'`);
    }
  });

  it('ships typed relative API access with revision conflict handling', async () => {
    const api = await source('src/api/transport.ts');

    expect(api).toContain("const API_BASE = '/api'");
    expect(api).toContain("credentials: 'same-origin'");
    expect(api).toContain("headers.set('If-Match', revision)");
    expect(api).toContain('class ApiConflictError');
    expect(api).toMatch(/response\.status === 409/);
    expect(api).toContain('URLSearchParams');
  });

  it('uses a shared editorial shell with keyboard-accessible navigation', async () => {
    const shell = await source('src/components/AppShell.tsx');

    for (const label of ['工作台', '文章', '剪切板', '图片库', '备份', '发布与日志']) {
      expect(shell).toContain(label);
    }
    expect(shell).toContain('跳到主要内容');
    expect(shell).toContain('aria-label="主导航"');
    expect(shell).toContain('aria-expanded');
  });

  it('supports password plus TOTP or recovery-code login', async () => {
    const login = await source('src/pages/LoginPage.tsx');

    expect(login).toContain('用户名');
    expect(login).toContain('密码');
    expect(login).toContain('动态验证码');
    expect(login).toContain('恢复码');
    expect(login).toContain('autoComplete="one-time-code"');
  });
  it('provides a guarded three-step first-run setup with a TOTP QR code', async () => {
    const [app, setup, api] = await Promise.all([
      source('src/App.tsx'),
      source('src/pages/SetupPage.tsx'),
      source('src/api/auth.ts'),
    ]);

    expect(app).toContain("path: '/setup'");
    expect(setup).toContain("from 'qrcode'");
    expect(setup).toContain('创建管理员');
    expect(setup).toContain('扫描 TOTP 二维码');
    expect(setup).toContain('恢复码只显示这一次');
    expect(setup).toContain('autoComplete="one-time-code"');
    expect(api).toContain("'/auth/setup/status'");
    expect(api).toContain("'/auth/setup/begin'");
    expect(api).toContain("'/auth/setup/confirm'");
    expect(api).not.toContain("'/auth/register'");
  });

  it('implements the complete content, asset, backup, publish and log workspace', async () => {
    const files = [
      'src/pages/DashboardPage.tsx',
      'src/pages/PostsPage.tsx',
      'src/pages/PostEditorPage.tsx',
      'src/pages/ClipsPage.tsx',
      'src/pages/ClipEditorPage.tsx',
      'src/pages/ImagesPage.tsx',
      'src/pages/BackupsPage.tsx',
      'src/pages/PublishPage.tsx',
      'src/pages/SecurityPage.tsx',
    ];

    for (const file of files) {
      const contents = await source(file);
      expect(contents, file).toMatch(/export (?:default )?function/);
    }

    expect(await source('src/pages/ImagesPage.tsx')).toContain('accept="image/jpeg,image/png,image/webp"');
    expect(await source('src/pages/BackupsPage.tsx')).toContain('创建备份');
    expect(await source('src/pages/PublishPage.tsx')).toContain('aria-live="polite"');
  });

  it('provides CodeMirror editing, two-second autosave, shortcuts, conflicts and preview workflows', async () => {
    const [editor, postEditor, actions] = await Promise.all([
      source('src/components/MarkdownEditor.tsx'),
      source('src/pages/PostEditorPage.tsx'),
      source('src/lib/editor-actions.ts'),
    ]);

    expect(editor).toContain("from '@codemirror/view'");
    expect(editor).toContain("from '@codemirror/lang-markdown'");
    expect(editor).toContain('EditorView.updateListener');
    expect(editor).toContain('insertText');
    expect(editor).toContain('const defaultExtensions: Extension[] = []');
    expect(editor).toContain('extensions = defaultExtensions');
    expect(editor).not.toContain('extensions = []');
    expect(editor).toContain('const onReadyRef = useRef(onReady)');
    expect(editor).toContain('onReadyRef.current = onReady');
    expect(editor).toContain('}, [ariaLabel, extensions, language]);');
    expect(editor).not.toContain('[ariaLabel, extensions, onReady]');
    expect(postEditor).toMatch(/useAutosave\([\s\S]*2000/);
    expect(postEditor).toContain('ApiConflictError');
    expect(postEditor).toContain('内容版本冲突');
    expect(postEditor).not.toContain('完整预览');
    expect(postEditor).toContain('sandbox=""');
    expect(postEditor).toContain('updatedAt: todayInShanghai()');
    expect(postEditor).not.toContain('???');
    expect(actions).toContain('createClipFence');
    expect(actions).toContain('createImageMarkdown');
    expect(actions).toContain("key.toLowerCase() === 's'");
  });

  it('exposes history, automatic metadata, linked-resource and SSE workflows', async () => {
    const [postEditor, clipEditor, publishPage, operations] = await Promise.all([
      source('src/pages/PostEditorPage.tsx'),
      source('src/pages/ClipEditorPage.tsx'),
      source('src/pages/PublishPage.tsx'),
      source('src/api/operations.ts'),
    ]);

    expect(postEditor).toContain('listPostHistory');
    expect(postEditor).toContain('restorePostHistory');
    expect(postEditor).toContain('automaticPostSlug');
    expect(postEditor).toContain('createClipAtCursor');
    expect(postEditor).toContain("updateFrontmatter('cover'");
    expect(clipEditor).toContain('automaticClipSlug');
    expect(clipEditor).toContain('deleteClip');
    expect(postEditor).toContain('insertExistingClip');
    expect(clipEditor).toContain('clipDownloadUrl');
    expect(await source('src/pages/ClipsPage.tsx')).toContain('importClip');
    expect(publishPage).toContain('subscribePublishJob');
    expect(publishPage).not.toContain('???');
    expect(operations).toContain('new EventSource');
  });

  it('uses the site confirmation provider instead of native browser dialogs', async () => {
    const [app, provider, ...pages] = await Promise.all([
      source('src/App.tsx'),
      source('src/context/ConfirmDialogContext.tsx'),
      source('src/pages/BackupsPage.tsx'),
      source('src/pages/ClipEditorPage.tsx'),
      source('src/pages/ClipsPage.tsx'),
      source('src/pages/ImagesPage.tsx'),
      source('src/pages/PostsPage.tsx'),
      source('src/pages/PostEditorPage.tsx'),
      source('src/pages/PublishPage.tsx'),
    ]);

    expect(app).toContain('ConfirmDialogProvider');
    expect(provider).toContain('role="alertdialog"');
    expect(provider).toContain('useConfirmDialog');
    expect(pages.join('\n')).not.toContain('window.confirm');
  });
  it('keeps the high-density paper-and-ink visual system responsive and accessible', async () => {
    const [entryCss, themeCss] = await Promise.all([
      source('src/styles.css'),
      source('src/styles/theme.css'),
    ]);
    const css = `${entryCss}\n${themeCss}`;

    expect(entryCss.trimStart().startsWith("@import './styles/theme.css';")).toBe(true);
    expect(css).toContain('--paper:');
    expect(css).toContain('--accent: #c74776');
    expect(css).toContain("--page-background: url('/site-background.webp')");
    expect(css).toContain('var(--page-background)');
    expect(css).toContain('--ink:');
    expect(css).toContain('--coral:');
    expect(css).toContain('.workspace-shell');
    expect(css).toContain('.editor-grid');
    expect(css).toContain('@media (max-width:');
    expect(css).toContain(':focus-visible');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).not.toMatch(/\b(?:Inter|Arial)\b/i);
    expect(css).not.toMatch(/(?:purple|violet|#(?:6d28d9|7c3aed|8b5cf6))/i);
  });

  it('provides a scoped API token security workspace with one-time secret display', async () => {
    const [app, shell, page, authApi] = await Promise.all([
      source('src/App.tsx'),
      source('src/components/AppShell.tsx'),
      source('src/pages/SecurityPage.tsx'),
      source('src/api/auth.ts'),
    ]);

    expect(app).toContain("path: '/security'");
    expect(shell).toContain("to: '/security'");
    expect(page).toContain('createApiToken');
    expect(page).toContain('revokeApiToken');
    expect(page).toContain('明文令牌只显示这一次');
    expect(page).toContain('posts:write');
    expect(authApi).toContain("'/auth/tokens'");
  });

  it('contains syntactically valid TypeScript and TSX sources', async () => {
    const files = [
      'src/main.tsx',
      'src/App.tsx',
      'src/api/auth.ts',
      'src/api/client.ts',
      'src/api/clips.ts',
      'src/api/images.ts',
      'src/api/operations.ts',
      'src/api/posts.ts',
      'src/api/transport.ts',
      'src/components/AppShell.tsx',
      'src/context/ConfirmDialogContext.tsx',
      'src/components/MarkdownEditor.tsx',
      'src/hooks/useAutosave.ts',
      'src/lib/editor-actions.ts',
      'src/lib/preview.ts',
      'src/pages/LoginPage.tsx',
      'src/pages/SetupPage.tsx',
      'src/components/AppearanceControls.tsx',
      'src/lib/preferences.ts',
      'src/pages/DashboardPage.tsx',
      'src/pages/PostsPage.tsx',
      'src/pages/PostEditorPage.tsx',
      'src/pages/ClipsPage.tsx',
      'src/pages/ClipEditorPage.tsx',
      'src/pages/ImagesPage.tsx',
      'src/pages/BackupsPage.tsx',
      'src/pages/PublishPage.tsx',
    ];

    for (const file of files) {
      const contents = await source(file);
      expect(contents, file).not.toBe('');
      const output = ts.transpileModule(contents, {
        compilerOptions: {
          jsx: ts.JsxEmit.ReactJSX,
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
        },
        fileName: file,
        reportDiagnostics: true,
      });
      const errors = (output.diagnostics ?? []).filter(
        (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
      );
      expect(errors, file).toEqual([]);
    }
  });
});







it('keeps the API facade small and delegates transport and domain operations', async () => {
  const [client, transport] = await Promise.all([
    source('src/api/client.ts'),
    source('src/api/transport.ts'),
  ]);
  expect(client.split(/\r?\n/).length).toBeLessThan(40);
  expect(client).toContain("import { postsApi } from './posts'");
  expect(client).toContain('...postsApi');
  expect(client).toContain("export { ApiConflictError, ApiError } from './transport'");
  expect(transport).toContain("const API_BASE = '/api'");
  expect(transport).toContain("credentials: 'same-origin'");
  expect(transport).toContain("headers.set('If-Match', revision)");
  expect(transport).toContain('class ApiConflictError');
  expect(transport).toMatch(/response\.status === 409/);
  expect(transport).toContain('URLSearchParams');
});
