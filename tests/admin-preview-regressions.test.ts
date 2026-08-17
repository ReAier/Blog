import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const root = new URL('../', import.meta.url);
const read = (path: string) => readFile(new URL(path, root), 'utf8');

describe('admin preview regressions', () => {
  it('wraps rendered Markdown with the same site and KaTeX styles as the public blog', async () => {
    const previewModule = await import('../admin/client/src/lib/preview');
    const buildDocument = (previewModule as Record<string, unknown>).buildInstantPreviewDocument;

    expect(buildDocument).toBeTypeOf('function');
    if (typeof buildDocument !== 'function') return;

    const html = buildDocument(
      '<aside class="problem-card glass">P1171</aside><span class="katex">x</span>',
      '.problem-card{border:1px solid red}',
      '.katex-mathml{position:absolute;clip:rect(1px,1px,1px,1px)}',
    ) as string;

    expect(html).toContain('<!doctype html>');
    expect(html).toContain('data-theme="dark"');
    expect(html).toContain('<base href="/">');
    expect(html).toContain('class="prose"');
    expect(html).toContain('.problem-card{border:1px solid red}');
    expect(html).toContain('.katex-mathml{position:absolute');
  });


  it('rewrites same-site public media URLs for unpublished instant-preview images', async () => {
    const previewRoutes = await import('../admin/server/routes/previews');
    const rewrite = (previewRoutes as Record<string, unknown>).previewManagedImageUrl;

    expect(rewrite).toBeTypeOf('function');
    if (typeof rewrite !== 'function') return;

    expect(rewrite(
      'https://blog.reaier.top/media/screenshots/example.webp',
      'https://blog.reaier.top',
    )).toBe('/media/screenshots/example.webp');
    expect(rewrite(
      'https://cdn.example.com/media/example.webp',
      'https://blog.reaier.top',
    )).toBe('https://cdn.example.com/media/example.webp');
    expect(rewrite(
      'https://blog.reaier.top/posts/example/',
      'https://blog.reaier.top',
    )).toBe('https://blog.reaier.top/posts/example/');
  });
  it('serves KaTeX fonts to the sandboxed instant-preview document', async () => {
    const routes = await read('admin/server/routes/previews.ts');

    expect(routes).toContain("'url(fonts/'");
    expect(routes).toContain("'url(/preview-assets/katex/fonts/'");
    expect(routes).toContain("app.get('/preview-assets/katex/fonts/:name'");
    expect(routes).toContain("reply.header('Access-Control-Allow-Origin', '*')");
  });

  it('uses language-aware CodeMirror support for Clip source files', async () => {
    const [clipEditor, markdownEditor, actions, packageJson] = await Promise.all([
      read('admin/client/src/pages/ClipEditorPage.tsx'),
      read('admin/client/src/components/MarkdownEditor.tsx'),
      import('../admin/client/src/lib/editor-actions'),
      read('package.json'),
    ]);
    const normalizeLanguage = (actions as Record<string, unknown>).normalizeCodeLanguage;

    expect(clipEditor).toContain('language={draft.language}');
    expect(markdownEditor).toContain('language?: string');
    expect(markdownEditor).toContain('codeLanguageExtension(language)');
    expect(normalizeLanguage).toBeTypeOf('function');
    if (typeof normalizeLanguage === 'function') {
      expect(normalizeLanguage('c++')).toBe('cpp');
      expect(normalizeLanguage('TypeScript')).toBe('typescript');
      expect(normalizeLanguage('py')).toBe('python');
    }
    expect(packageJson).toContain('"@codemirror/lang-cpp"');
    expect(packageJson).toContain('"@codemirror/lang-python"');
  });

  it('does not expose the removed full-preview workflow in the editor', async () => {
    const [editor, apiClient, previewHelpers, previewRoutes] = await Promise.all([
      read('admin/client/src/pages/PostEditorPage.tsx'),
      read('admin/client/src/api/client.ts'),
      read('admin/client/src/lib/preview.ts'),
      read('admin/server/routes/previews.ts'),
    ]);

    expect(editor).not.toContain('完整预览');
    expect(editor).not.toContain('openFullPreview');
    expect(editor).not.toContain('fullPreviewBusy');
    expect(apiClient).not.toContain('createExactPreview');
    expect(apiClient).not.toContain('subscribeExactPreview');
    expect(apiClient).not.toContain('previewPost:');
    expect(apiClient).not.toContain('openPostPreviewUrl:');
    expect(previewHelpers).not.toContain('resolveExactPreviewUrl');
    expect(previewHelpers).not.toContain('writePreviewLoadingDocument');
    expect(previewRoutes).not.toContain('/api/previews/exact');
    expect(previewRoutes).not.toContain('/api/preview/posts');
    expect(previewRoutes).not.toContain('createBuildSnapshot');
    expect(previewRoutes).not.toContain('ExactPreviewJob');
  });
});

describe('image upload controls', () => {
  it('opens an upload dialog that collects files without an owner slug', async () => {
    const page = await read('admin/client/src/pages/ImagesPage.tsx');
    const styles = await read('admin/client/src/styles.css');

    expect(page).toContain('function ImageUploadDialog(');
    expect(page).toContain('<Dialog');
    expect(page).toContain('initialFocusRef={fileInput}');
    expect(page).toContain('const [showUpload, setShowUpload] = useState(false)');
    expect(page).not.toContain('uploadOwner');
    expect(page).toContain('const [selectedFiles, setSelectedFiles] = useState<File[]>([])');
    expect(page).toContain('api.uploadImage(file)');
    expect(page).toContain('setShowUpload(true)');
    expect(page).toContain('files={selectedFiles}');
    expect(page).not.toContain('const chooseFiles = () =>');
    expect(styles).toContain('.image-upload-dialog');
    expect(styles).toContain('.selected-file-list');
  });
});

describe('deployment warning policy', () => {
  it('avoids deprecated Zod and Vitest APIs reported by deployment checks', async () => {
    const [contentConfig, authSetup, contentCore] = await Promise.all([
      read('src/content.config.ts'),
      read('tests/admin-auth-setup.test.ts'),
      read('tests/admin-content-core.test.ts'),
    ]);

    expect(contentConfig).toContain('z.url()');
    expect(contentConfig).not.toContain('z.string().url()');
    expect(authSetup).not.toContain('.toThrowError(');
    expect(contentCore).not.toContain('.toThrowError(');
  });

  it('suppresses only React Router module-directive noise and gives jsdom a real origin', async () => {
    const [viteConfig, vitestConfig, testSetup] = await Promise.all([
      read('admin/client/vite.config.ts'),
      read('vitest.config.ts'),
      read('tests/setup.ts'),
    ]);

    expect(viteConfig).toContain("warning.code === 'MODULE_LEVEL_DIRECTIVE'");
    expect(viteConfig).toContain("react-router");
    expect(vitestConfig).toContain('environmentOptions');
    expect(vitestConfig).toContain("url: 'http://localhost/'");
    expect(vitestConfig).toContain("setupFiles: ['./tests/setup.ts']");
    expect(testSetup).toContain("Object.defineProperty(window, 'localStorage'");
  });


  it('validates and builds the content snapshot without rerunning code-unit tests', async () => {
    const runner = await import('../admin/server/publish/runner');
    const commands = (runner as Record<string, unknown>).SITE_VERIFICATION_COMMANDS;
    const environment = (runner as Record<string, unknown>).siteVerificationEnvironment;

    expect(commands).toEqual([
      ['run', 'check'],
      ['run', 'build'],
    ]);
    expect(environment).toBeTypeOf('function');
    if (typeof environment !== 'function') return;
    expect(environment()).toEqual({ BLOG_BUILD_SNAPSHOT: '1' });
  });

  it('invokes npm through Node on Windows instead of spawning npm.cmd directly', async () => {
    const runner = await import('../admin/server/publish/runner');
    const resolveInvocation = (runner as Record<string, unknown>).resolveNpmInvocation;

    expect(resolveInvocation).toBeTypeOf('function');
    if (typeof resolveInvocation !== 'function') return;

    expect(resolveInvocation(['run', 'build'], {
      platform: 'win32',
      execPath: 'D:/NodeJs/node.exe',
      npmExecPath: 'D:/NodeJs/node_modules/npm/bin/npm-cli.js',
    })).toEqual({
      command: 'D:/NodeJs/node.exe',
      args: ['D:/NodeJs/node_modules/npm/bin/npm-cli.js', 'run', 'build'],
    });
  });
  it('uses aligned environments instead of top-level display-math line breaks', async () => {
    const article = await read('src/content/blog/BitDP.md');

    expect(article).toContain('\\begin{aligned}');
    expect(article).not.toContain('\\right\\}\\\\\nscore_T=');
    expect(article).not.toContain('F_S=\\max_{T\\subseteq \\overline{S}} f_T\\\\');
  });
});


describe('admin editor information layout', () => {
  it('places post and Clip metadata above the writing workspace', async () => {
    const [styles, postEditor, clipEditor] = await Promise.all([
      read('admin/client/src/styles.css'),
      read('admin/client/src/pages/PostEditorPage.tsx'),
      read('admin/client/src/pages/ClipEditorPage.tsx'),
    ]);

    expect(postEditor).toContain('className="frontmatter-form editor-info-form post-metadata-grid"');
    expect(clipEditor).toContain('className="frontmatter-form editor-info-form"');
    expect(styles).toContain('grid-template-areas:');
    expect(styles).toContain("'info info'");
    expect(styles).toContain("'writing preview'");
    expect(styles).toContain("'info'");
    expect(styles).toContain("'writing'");
    expect(styles).toContain('.editor-info-form');
  });
});
