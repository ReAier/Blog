import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createClipFence,
  createImageMarkdown,
  isSaveShortcut,
} from '../admin/client/src/lib/editor-actions';
import { buildInstantPreview } from '../admin/client/src/lib/preview';

const clientRoot = join(process.cwd(), 'admin', 'client', 'src');
const readClient = (path: string) => readFile(join(clientRoot, path), 'utf8');
describe('admin editor insertion helpers', () => {
  it('creates the blog clip fence contract', () => {
    expect(createClipFence({
      title: 'Fenwick Tree',
      description: 'Reusable implementation',
      language: 'cpp',
      file: 'fenwick.cpp',
      createdAt: '2026-08-13',
    })).toBe([
      '```clip',
      'title: Fenwick Tree',
      'description: Reusable implementation',
      'language: cpp',
      'file: fenwick.cpp',
      'createdAt: 2026-08-13',
      '```',
    ].join('\n'));
  });

  it('escapes image alt text and emits an optional title', () => {
    expect(createImageMarkdown({
      alt: 'diagram [draft]',
      path: '/images/post/diagram.webp',
      title: 'Architecture "v2"',
    })).toBe('![diagram \\[draft\\]](/images/post/diagram.webp "Architecture \\"v2\\"")');
  });

  it('recognizes Ctrl+S and Command+S without accepting plain S', () => {
    expect(isSaveShortcut({ key: 's', ctrlKey: true, metaKey: false })).toBe(true);
    expect(isSaveShortcut({ key: 'S', ctrlKey: false, metaKey: true })).toBe(true);
    expect(isSaveShortcut({ key: 's', ctrlKey: false, metaKey: false })).toBe(false);
  });
});

describe('instant preview sandbox document', () => {
  it('escapes raw HTML while rendering headings, emphasis, code and links', () => {
    const html = buildInstantPreview('# Hello\n\nA **bold** [link](https://example.com).\n\n`code` <script>bad()</script>');

    expect(html).toContain('<h1>Hello</h1>');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<a href="https://example.com" target="_blank" rel="noreferrer">link</a>');
    expect(html).toContain('<code>code</code>');
    expect(html).toContain('&lt;script&gt;bad()&lt;/script&gt;');
    expect(html).not.toContain('<script>bad()</script>');
  });
});

describe('admin content editor source contracts', () => {
  it('uses a compact article import button and opens the imported article', async () => {
    const page = await readClient('pages/PostsPage.tsx');

    expect(page).toContain('useNavigate');
    expect(page).toContain('const imported = await api.importPost(file)');
    expect(page).toContain('navigate(`/posts/${encodeURIComponent(imported.slug)}`)');
    expect(page).toContain('>导入</button>');
    expect(page).not.toContain('导入 .md');
  });
  it('uses dialogs to manage post tags and choose an uploaded cover', async () => {
    const page = await readClient('pages/PostEditorPage.tsx');
    const pickers = await readClient('components/PostMetadataPickers.tsx');

    expect(page).toContain('<TagPickerDialog');
    expect(page).toContain('<CoverPickerDialog');
    expect(page).toContain('管理标签');
    expect(page).toContain('选择封面');
    expect(page).not.toContain('使用逗号分隔。');
    expect(page).not.toContain('placeholder="../images/post/cover.webp"');
    expect(page).not.toContain('创建后请使用显式迁移');
    expect(page).not.toContain('参与 featured 排序');
    expect(pickers).toContain('<Dialog');
    expect(pickers).toContain('ariaLabelledBy={titleId}');
    expect(pickers).toContain('aria-pressed={selected.includes(tag)}');
    expect(pickers).toContain('<span>搜索标签</span>');
    expect(pickers).toContain("setView('create')");
    expect(pickers).toContain("import { Dialog } from './Dialog'");
    expect(pickers).not.toContain('createPortal');
    expect(page).toContain("import { Dialog } from '../components/Dialog'");
    expect(page).not.toContain('createPortal');
    expect(pickers).not.toContain('<span>新建标签</span>');
    expect(pickers).toContain('image.markdownPath');
  });
  it('uses a compact clip import button and metadata dialog', async () => {
    const page = await readClient('pages/ClipsPage.tsx');
    const dialog = await readClient('components/ClipImportDialog.tsx');

    expect(page).toContain('>导入</button>');
    expect(page).toContain('<ClipImportDialog');
    expect(page).toContain('resetImport();');
    expect(page).not.toContain('<details className="paper-strip import-panel">');
    expect(page).not.toContain('导入源码文件');
    expect(dialog).toContain('<Dialog');
    expect(dialog).toContain('initialFocusRef={titleInput}');
    expect(dialog).toContain('<BlogSelect');
    expect(dialog).not.toContain('<select');
  });
  it('uses a language select and removes the clip reference notice', async () => {
    const page = await readClient('pages/ClipEditorPage.tsx');

    expect(page).toContain('options={clipLanguageOptions(draft.language)}');
    expect(page).toContain('<BlogSelect');
    expect(page).not.toContain('<select');
    expect(page).not.toContain('引用契约');
    expect(page).not.toContain('文章只通过 Clip slug 引用此资源');
    expect(page).toContain('compact-info-panel');
    expect(page).not.toContain('<span>Slug</span>');
    expect(page).not.toContain('设为今天');
  });
});





describe('streamlined automatic editor metadata', () => {
  it('removes manual article slug and update-date controls', async () => {
    const page = await readClient('pages/PostEditorPage.tsx');

    expect(page).toContain('automaticPostSlug');
    expect(page).toContain('updatedAt: todayInShanghai()');
    expect(page).not.toContain('<span>Slug</span>');
    expect(page).not.toContain('设为今天');
    expect(page).not.toContain('本次发布更新');
    expect(page).not.toContain('迁移 slug');
  });

  it('derives clip slug and update date without exposing controls', async () => {
    const page = await readClient('pages/ClipEditorPage.tsx');

    expect(page).toContain('automaticClipSlug');
    expect(page).toContain('updatedAt: todayInShanghai()');
    expect(page).not.toContain('<span>Slug</span>');
    expect(page).not.toContain('设为今天');
    expect(page).not.toContain('迁移文件名 / slug');
  });
});
