# 后台内容导入与编辑器紧凑化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让文章支持无 frontmatter Markdown 导入，并将文章、剪切板和工作台的资源编辑界面改为紧凑、按钮驱动的交互。

**Architecture:** 保留 `parsePostMarkdown` 作为仓库存储格式的严格解析器，新增独立的 `parseImportedPostMarkdown` 负责清理前导空白并为普通 Markdown 推导元数据。客户端把标签、封面和剪切板导入拆为小型可复用弹窗，页面只负责加载数据与更新表单状态。

**Tech Stack:** Astro 7、React 19、TypeScript 6、Fastify 5、Vitest 4、CSS。

## Global Constraints

- 仓库最终保存的文章仍必须包含合法 frontmatter。
- 不改变 `/clips` 路由、后端 API、公开剪切板 URL 或内部类型命名。
- 文章封面只能从图片库已有资源选择，不在文章编辑器内上传。
- 面向用户的 `Clips`/`Clip` 文案统一改为“剪切板”或“剪切内容”。
- 保留现有两空格缩进、TypeScript 单引号、分号和多行尾逗号风格。
- 每个行为修改先写失败测试，再写最小实现。

## File Map

- `admin/server/content/markdown.ts`：严格解析、导入解析、标题/摘要/slug 推导。
- `admin/server/content/index.ts`：导出新增导入解析接口。
- `admin/server/routes/posts.ts`：文章导入端点调用宽容导入解析器。
- `admin/client/src/pages/PostsPage.tsx`：紧凑文章导入按钮，成功后进入编辑页。
- `admin/client/src/components/PostMetadataPickers.tsx`：标签和封面选择弹窗。
- `admin/client/src/pages/PostEditorPage.tsx`：接入标签/封面选择器并精简提示。
- `admin/client/src/components/ClipImportDialog.tsx`：剪切板文件导入元数据弹窗。
- `admin/client/src/lib/languages.ts`：剪切板语言选项及未知值兼容函数。
- `admin/client/src/pages/ClipsPage.tsx`：按钮触发剪切板导入弹窗。
- `admin/client/src/pages/ClipEditorPage.tsx`：语言下拉、紧凑信息栏、删除引用提示。
- `admin/client/src/components/AppShell.tsx`：顶栏“剪切板”文案。
- `admin/client/src/pages/DashboardPage.tsx`：删除资源整理和编辑提示。
- `admin/client/src/styles.css`：弹窗、标签块、封面预览和紧凑布局。
- `tests/admin-content-core.test.ts`：导入解析单元测试。
- `tests/admin-api.test.ts`：普通 Markdown 上传 API 回归测试。
- `tests/admin-client-editor.test.ts`：编辑器和选择器源代码契约。
- `tests/admin-client-shell.test.ts`、`tests/admin-client-visual.test.ts`：导航、工作台和视觉契约。

---

### Task 1: 宽容的文章 Markdown 导入解析

**Files:**
- Modify: `admin/server/content/markdown.ts`
- Modify: `admin/server/content/index.ts`
- Test: `tests/admin-content-core.test.ts`

**Interfaces:**
- Produces: `parseImportedPostMarkdown(markdown: string, fileName: string, publishedAt: string): PostDocument`
- Keeps: `parsePostMarkdown(markdown: string, slug: string): PostDocument` strict for stored content.

- [ ] **Step 1: Add failing import parser tests**

在 `tests/admin-content-core.test.ts` 的 strict parser describe 后增加：

```ts
describe('post Markdown import parsing', () => {
  it('accepts BOM and blank lines before valid frontmatter', () => {
    const imported = parseImportedPostMarkdown(`\uFEFF\n\n${validMarkdown}`, 'strict-post.md', '2026-08-15');
    expect(imported.slug).toBe('strict-post');
    expect(imported.title).toBe('A strict post');
  });

  it('creates draft frontmatter for plain Markdown', () => {
    const imported = parseImportedPostMarkdown(
      '# Imported title\n\nA useful introductory paragraph.\n\nMore text.\n',
      'My Imported_Post.md',
      '2026-08-15',
    );
    expect(imported).toEqual({
      slug: 'my-imported-post',
      title: 'Imported title',
      description: 'A useful introductory paragraph.',
      publishedAt: '2026-08-15',
      tags: [],
      draft: true,
      featured: false,
      body: '# Imported title\n\nA useful introductory paragraph.\n\nMore text.\n',
    });
  });

  it('falls back to the file name when plain Markdown has no heading or paragraph', () => {
    const imported = parseImportedPostMarkdown('```ts\nconst value = 1;\n```\n', 'Code Sample.md', '2026-08-15');
    expect(imported.title).toBe('Code Sample');
    expect(imported.description).toBe('Code Sample');
    expect(imported.slug).toBe('code-sample');
  });

  it('does not treat malformed frontmatter as plain Markdown', () => {
    expect(() => parseImportedPostMarkdown('---\ntitle: Broken\n', 'broken.md', '2026-08-15'))
      .toThrow(/frontmatter closing delimiter/i);
  });
});
```

并把 `parseImportedPostMarkdown` 加入文件顶部 import。

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- --run tests/admin-content-core.test.ts`

Expected: FAIL because `parseImportedPostMarkdown` is not exported.

- [ ] **Step 3: Implement import parsing without weakening strict parsing**

在 `admin/server/content/markdown.ts` 增加：

```ts
function importSlug(fileName: string): string {
  const stem = fileName.replace(/\.md$/i, '').trim();
  const slug = stem
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!slug) {
    throw new ContentValidationError('无法从 Markdown 文件名生成文章 slug，请先使用英文或数字重命名文件。');
  }
  validateSlug(slug);
  return slug;
}

function plainMarkdownTitle(markdown: string, fileName: string): string {
  const heading = markdown.match(/^#\s+(.+?)\s*$/m)?.[1]?.trim();
  return heading || fileName.replace(/\.md$/i, '').trim();
}

function plainMarkdownDescription(markdown: string, fallback: string): string {
  const withoutFences = markdown.replace(/```[\s\S]*?```/g, '');
  const paragraph = withoutFences
    .split(/\n\s*\n/)
    .map((block) => block.replace(/^#{1,6}\s+.*$/gm, '').trim())
    .find((block) => block && !/^(?:[-*>]|\d+\.)\s/.test(block));
  return (paragraph || fallback).replace(/\s+/g, ' ').slice(0, 180);
}

export function parseImportedPostMarkdown(
  markdown: string,
  fileName: string,
  publishedAt: string,
): PostDocument {
  const normalized = markdown.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const candidate = normalized.replace(/^\s*(?=---(?:\n|$))/, '');
  const slug = importSlug(fileName);
  if (candidate.startsWith('---\n')) return parsePostMarkdown(candidate, slug);
  if (candidate.startsWith('---')) return parsePostMarkdown(candidate, slug);

  const title = plainMarkdownTitle(normalized, fileName);
  return {
    slug,
    title,
    description: plainMarkdownDescription(normalized, title),
    publishedAt: validateDate(publishedAt, 'publishedAt'),
    tags: [],
    draft: true,
    featured: false,
    body: normalized,
  };
}
```

在 `admin/server/content/index.ts` 从 `./markdown` 导出该函数。

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `npm test -- --run tests/admin-content-core.test.ts`

Expected: all tests in the file PASS.

- [ ] **Step 5: Commit**

```powershell
git add admin/server/content/markdown.ts admin/server/content/index.ts tests/admin-content-core.test.ts
git commit -m "fix: support importing plain markdown posts"
```

---

### Task 2: Route imported posts through the new parser

**Files:**
- Modify: `admin/server/routes/posts.ts`
- Test: `tests/admin-api.test.ts`

**Interfaces:**
- Consumes: `parseImportedPostMarkdown(markdown, fileName, publishedAt)` from Task 1.
- Produces: `POST /api/posts/import` response containing the normalized stored post.

- [ ] **Step 1: Add a failing multipart API regression test**

在 `tests/admin-api.test.ts` 增加辅助函数和测试：

```ts
function multipartMarkdown(fileName: string, source: string) {
  const boundary = '----blog-admin-test';
  return {
    boundary,
    payload: [
      `--${boundary}`,
      `Content-Disposition: form-data; name="file"; filename="${fileName}"`,
      'Content-Type: text/markdown',
      '',
      source,
      `--${boundary}--`,
      '',
    ].join('\r\n'),
  };
}

it('imports plain Markdown by generating stored frontmatter', async () => {
  const { app, database } = await fixture();
  const upload = multipartMarkdown('Imported Note.md', '# Imported note\n\nImported summary.\n');
  const response = await app.inject({
    method: 'POST',
    url: '/api/posts/import',
    headers: {
      origin: 'https://admin.blog.reaier.top',
      'x-csrf-token': 'csrf',
      'content-type': `multipart/form-data; boundary=${upload.boundary}`,
    },
    payload: upload.payload,
  });
  expect(response.statusCode).toBe(201);
  expect(response.json()).toMatchObject({
    slug: 'imported-note',
    title: 'Imported note',
    description: 'Imported summary.',
    draft: true,
  });
  await app.close();
  database.close();
});
```

- [ ] **Step 2: Run the API test and verify RED**

Run: `npm test -- --run tests/admin-api.test.ts`

Expected: FAIL with status 400 and the existing frontmatter error.

- [ ] **Step 3: Use Shanghai date and the import parser in the route**

在 `admin/server/routes/posts.ts`：

```ts
import { parseImportedPostMarkdown, serializePostMarkdown } from '../content/markdown';

function shanghaiDate(): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
```

将导入调用替换为：

```ts
const imported = parseImportedPostMarkdown(bytes.toString('utf8'), file.filename, shanghaiDate());
const created = await repository.createPost(imported);
```

- [ ] **Step 4: Run API and content tests**

Run: `npm test -- --run tests/admin-api.test.ts tests/admin-content-core.test.ts`

Expected: both files PASS.

- [ ] **Step 5: Commit**

```powershell
git add admin/server/routes/posts.ts tests/admin-api.test.ts
git commit -m "fix: import markdown without frontmatter"
```

---

### Task 3: Replace the article upload label and navigate to imported content

**Files:**
- Modify: `admin/client/src/pages/PostsPage.tsx`
- Test: `tests/admin-client-editor.test.ts`

**Interfaces:**
- Consumes: `api.importPost(file): Promise<PostDocument>`.
- Produces: compact button text `导入` and navigation to `/posts/:slug`.

- [ ] **Step 1: Add failing source-contract assertions**

```ts
it('uses a compact article import button and opens the imported article', async () => {
  const page = await read('pages/PostsPage.tsx');
  expect(page).toContain("useNavigate");
  expect(page).toContain("const imported = await api.importPost(file)");
  expect(page).toContain("navigate(`/posts/${encodeURIComponent(imported.slug)}`)");
  expect(page).toContain('>导入</button>');
  expect(page).not.toContain('导入 .md');
});
```

- [ ] **Step 2: Run the focused client test and verify RED**

Run: `npm test -- --run tests/admin-client-editor.test.ts`

Expected: FAIL because the page does not navigate and still contains `导入 .md`.

- [ ] **Step 3: Update the article list page**

在 `PostsPage.tsx` 中引入并创建 navigate：

```ts
import { Link, useNavigate } from 'react-router-dom';

const navigate = useNavigate();
```

导入成功逻辑改为：

```ts
const imported = await api.importPost(file);
setMessage(`已导入 ${file.name}`);
navigate(`/posts/${encodeURIComponent(imported.slug)}`);
```

按钮改为：

```tsx
<button className="secondary-button compact-action" type="button" onClick={() => importInput.current?.click()}>
  导入
</button>
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npm test -- --run tests/admin-client-editor.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add admin/client/src/pages/PostsPage.tsx tests/admin-client-editor.test.ts
git commit -m "ui: simplify article import action"
```

---

### Task 4: Add article tag and cover pickers

**Files:**
- Create: `admin/client/src/components/PostMetadataPickers.tsx`
- Modify: `admin/client/src/pages/PostEditorPage.tsx`
- Test: `tests/admin-client-editor.test.ts`

**Interfaces:**
- Produces: `TagPickerDialog` and `CoverPickerDialog`.
- `TagPickerDialog` props: `{ selected: string[]; available: string[]; onChange(tags: string[]): void; onClose(): void }`.
- `CoverPickerDialog` props: `{ images: ImageAsset[]; selected?: string; onSelect(path?: string): void; onClose(): void }`.

- [ ] **Step 1: Add failing picker contract tests**

```ts
it('uses dialogs to manage post tags and choose an uploaded cover', async () => {
  const page = await read('pages/PostEditorPage.tsx');
  const pickers = await read('components/PostMetadataPickers.tsx');
  expect(page).toContain('<TagPickerDialog');
  expect(page).toContain('<CoverPickerDialog');
  expect(page).toContain('管理标签');
  expect(page).toContain('选择封面');
  expect(page).not.toContain('使用逗号分隔。');
  expect(page).not.toContain('placeholder="../images/post/cover.webp"');
  expect(pickers).toContain('role="dialog"');
  expect(pickers).toContain('aria-modal="true"');
  expect(pickers).toContain("aria-pressed={selected.includes(tag)}");
  expect(pickers).toContain('image.markdownPath');
});
```

- [ ] **Step 2: Run focused test and verify RED**

Run: `npm test -- --run tests/admin-client-editor.test.ts`

Expected: FAIL because the picker component does not exist.

- [ ] **Step 3: Create accessible picker components**

`PostMetadataPickers.tsx` must:

```tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ImageAsset } from '../types';

export function TagPickerDialog({ selected, available, onChange, onClose }: TagPickerProps) {
  const [value, setValue] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const tags = useMemo(() => [...new Set([...available, ...selected])].sort((a, b) => a.localeCompare(b)), [available, selected]);
  useEffect(() => {
    input.current?.focus();
    const close = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [onClose]);
  const add = () => {
    const tag = value.trim();
    if (tag && !selected.includes(tag)) onChange([...selected, tag]);
    setValue('');
  };
  return (
    <div className="dialog-scrim" role="presentation">
      <section className="picker-dialog metadata-picker" role="dialog" aria-modal="true" aria-labelledby="tag-picker-title">
        {/* header, new-tag form, tag buttons, 完成 button */}
      </section>
    </div>
  );
}
```

`CoverPickerDialog` 使用 `.image-picker-item` 渲染 `image.url` 缩略图，点击时调用 `onSelect(image.markdownPath)`；顶部提供“清除封面”。完整 JSX 中所有按钮使用 `type="button"`，选中项使用 `aria-pressed={selected === image.markdownPath}`。

- [ ] **Step 4: Integrate pickers into PostEditorPage**

增加状态：

```ts
const [showTagPicker, setShowTagPicker] = useState(false);
const [showCoverPicker, setShowCoverPicker] = useState(false);
const [availableTags, setAvailableTags] = useState<string[]>([]);
```

增加资源加载函数：

```ts
const openTagPicker = async () => {
  setResourceBusy(true);
  try {
    const result = await api.listPosts();
    setAvailableTags([...new Set(result.items.flatMap((post) => post.tags))]);
    setShowTagPicker(true);
  } catch (reason) {
    setMessage(reason instanceof Error ? reason.message : '标签加载失败');
  } finally {
    setResourceBusy(false);
  }
};
```

封面选择复用 `api.listImages()`，但使用独立 `showCoverPicker` 状态。字段 JSX 改为标签块加“管理标签”按钮，以及封面缩略图加“选择封面/更换/清除”按钮。页面底部按状态渲染两个新弹窗。

同时删除：

```tsx
<small>创建后请使用显式迁移，避免链接失效。</small>
<small>不进入公开页面</small>
<small>参与 featured 排序</small>
```

摘要 `rows={4}` 改为 `rows={3}`。

- [ ] **Step 5: Run focused tests**

Run: `npm test -- --run tests/admin-client-editor.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add admin/client/src/components/PostMetadataPickers.tsx admin/client/src/pages/PostEditorPage.tsx tests/admin-client-editor.test.ts
git commit -m "feat: add post tag and cover pickers"
```

---

### Task 5: Replace the long clip import form with a dialog

**Files:**
- Create: `admin/client/src/components/ClipImportDialog.tsx`
- Create: `admin/client/src/lib/languages.ts`
- Modify: `admin/client/src/pages/ClipsPage.tsx`
- Test: `tests/admin-client-editor.test.ts`

**Interfaces:**
- Produces: `CLIP_LANGUAGES`, `clipLanguageOptions(current?: string): string[]`.
- Produces: `ClipImportDialog` accepting the selected `File`, form values, busy state, submit/change/close callbacks.

- [ ] **Step 1: Add failing clip import UI tests**

```ts
it('uses a compact clip import button and metadata dialog', async () => {
  const page = await read('pages/ClipsPage.tsx');
  const dialog = await read('components/ClipImportDialog.tsx');
  expect(page).toContain('>导入</button>');
  expect(page).toContain('<ClipImportDialog');
  expect(page).not.toContain('<details className="import-panel"');
  expect(page).not.toContain('导入源码文件');
  expect(dialog).toContain('role="dialog"');
  expect(dialog).toContain('<select');
});
```

- [ ] **Step 2: Run focused test and verify RED**

Run: `npm test -- --run tests/admin-client-editor.test.ts`

Expected: FAIL because the dialog does not exist and the details panel remains.

- [ ] **Step 3: Add the shared language options**

`admin/client/src/lib/languages.ts`：

```ts
export const CLIP_LANGUAGES = [
  'text', 'typescript', 'javascript', 'tsx', 'jsx', 'astro', 'html', 'css',
  'json', 'yaml', 'markdown', 'bash', 'powershell', 'python', 'c', 'cpp',
  'csharp', 'java', 'go', 'rust', 'sql',
] as const;

export function clipLanguageOptions(current?: string): string[] {
  return current && !CLIP_LANGUAGES.includes(current as never)
    ? [current, ...CLIP_LANGUAGES]
    : [...CLIP_LANGUAGES];
}
```

- [ ] **Step 4: Create ClipImportDialog**

弹窗显示文件名、标题、slug、语言、创建日期和描述；语言使用 `clipLanguageOptions(fields.language)`。提交时调用现有 `api.importClip(file, fields)` 所需的父组件回调。Escape、遮罩点击和关闭按钮在非 busy 状态关闭。

- [ ] **Step 5: Replace ClipsPage details panel**

保留隐藏 `<input type="file">`；顶部 `PageHeader.actions` 中增加：

```tsx
<button className="secondary-button compact-action" type="button" onClick={() => importInput.current?.click()}>
  导入
</button>
```

文件选择后设置 `importFile` 并显示 `<ClipImportDialog />`；删除整个 `<details className="import-panel">`。导入成功后关闭弹窗、清空文件 input、显示成功消息并 reload。

- [ ] **Step 6: Run focused tests**

Run: `npm test -- --run tests/admin-client-editor.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add admin/client/src/components/ClipImportDialog.tsx admin/client/src/lib/languages.ts admin/client/src/pages/ClipsPage.tsx tests/admin-client-editor.test.ts
git commit -m "ui: move clip import into a dialog"
```

---

### Task 6: Compact the clip editor and replace language text input

**Files:**
- Modify: `admin/client/src/pages/ClipEditorPage.tsx`
- Modify: `tests/admin-client-editor.test.ts`

**Interfaces:**
- Consumes: `clipLanguageOptions(current)` from Task 5.

- [ ] **Step 1: Add failing editor assertions**

```ts
it('uses a language select and removes the clip reference notice', async () => {
  const page = await read('pages/ClipEditorPage.tsx');
  expect(page).toContain('clipLanguageOptions(draft.language).map');
  expect(page).toMatch(/<select[\s\S]*value=\{draft\.language\}/);
  expect(page).not.toContain('引用契约');
  expect(page).not.toContain('文章只通过 Clip slug 引用此资源');
});
```

- [ ] **Step 2: Run focused test and verify RED**

Run: `npm test -- --run tests/admin-client-editor.test.ts`

Expected: FAIL because language is still an input and the notice exists.

- [ ] **Step 3: Replace the field and remove the notice**

导入 `clipLanguageOptions`，将语言字段替换为：

```tsx
<label className="field">
  <span>语言</span>
  <select value={draft.language} onChange={(event) => update('language', event.target.value)}>
    {clipLanguageOptions(draft.language).map((language) => (
      <option key={language} value={language}>{language === 'text' ? '纯文本' : language}</option>
    ))}
  </select>
</label>
```

删除 `editorial-tip compact-tip` 的引用契约 aside，并为信息 panel 增加 `compact-info-panel` 类。

- [ ] **Step 4: Run focused tests**

Run: `npm test -- --run tests/admin-client-editor.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add admin/client/src/pages/ClipEditorPage.tsx tests/admin-client-editor.test.ts
git commit -m "ui: compact clip metadata editing"
```

---

### Task 7: Update navigation copy and remove dashboard-only notices

**Files:**
- Modify: `admin/client/src/components/AppShell.tsx`
- Modify: `admin/client/src/pages/DashboardPage.tsx`
- Modify: `tests/admin-client-shell.test.ts`
- Modify: `tests/admin-client-visual.test.ts`

**Interfaces:**
- No runtime interface changes; copy and dashboard composition only.

- [ ] **Step 1: Add failing shell/dashboard tests**

```ts
it('labels the clip destination as 剪切板', async () => {
  const shell = await read('src/components/AppShell.tsx');
  expect(shell).toContain("{ to: '/clips', label: '剪切板' }");
  expect(shell).not.toContain("label: 'Clips'");
});
```

在 visual test 增加：

```ts
it('omits independent-resource hygiene and editor note from the dashboard', async () => {
  const dashboard = await read('pages/DashboardPage.tsx');
  expect(dashboard).not.toContain('hygiene-card');
  expect(dashboard).not.toContain('Content hygiene');
  expect(dashboard).not.toContain("EDITOR'S NOTE");
});
```

并把原导航标签数组中的 `Clips` 改为 `剪切板`。

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- --run tests/admin-client-shell.test.ts tests/admin-client-visual.test.ts`

Expected: FAIL on old copy and existing dashboard sections.

- [ ] **Step 3: Apply copy and dashboard changes**

`AppShell.tsx`：

```ts
{ to: '/clips', label: '剪切板' },
```

`DashboardPage.tsx`：统计项改为“剪切板”，删除 `SectionCard` 的待整理资源区块和底部 `editorial-tip`。

- [ ] **Step 4: Run focused tests**

Run: `npm test -- --run tests/admin-client-shell.test.ts tests/admin-client-visual.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add admin/client/src/components/AppShell.tsx admin/client/src/pages/DashboardPage.tsx tests/admin-client-shell.test.ts tests/admin-client-visual.test.ts
git commit -m "ui: rename clips and simplify dashboard"
```

---

### Task 8: Add compact styling and complete regression verification

**Files:**
- Modify: `admin/client/src/styles.css`
- Modify: `tests/admin-client-visual.test.ts`

**Interfaces:**
- Adds CSS hooks: `.compact-action`, `.metadata-picker`, `.tag-control`, `.selected-tags`, `.cover-control`, `.cover-preview`, `.compact-info-panel`.

- [ ] **Step 1: Add failing CSS contract tests**

```ts
it('defines compact metadata controls and picker states', async () => {
  const css = await read('styles.css');
  for (const selector of [
    '.compact-action', '.metadata-picker', '.tag-control', '.selected-tags',
    '.cover-control', '.cover-preview', '.compact-info-panel',
  ]) expect(css).toContain(selector);
  expect(css).toMatch(/\.editor-info-form\s*\{[^}]*gap:\s*(?:8|10|12)px/s);
  expect(css).toMatch(/\.compact-info-panel[\s\S]*\.frontmatter-form/s);
});
```

- [ ] **Step 2: Run visual test and verify RED**

Run: `npm test -- --run tests/admin-client-visual.test.ts`

Expected: FAIL because the compact selectors do not exist.

- [ ] **Step 3: Implement compact responsive CSS**

在现有 editor/picker 样式附近增加：

```css
.compact-action { min-width: 72px; padding-inline: 16px; }
.editor-info-form { gap: 10px; }
.editor-info-form .field { gap: 5px; }
.editor-info-form .field input,
.editor-info-form .field select { min-height: 40px; padding-block: 8px; }
.editor-info-form .field textarea { min-height: 88px; }
.compact-info-panel .frontmatter-form { gap: 10px; }
.tag-control, .cover-control { display: grid; gap: 8px; }
.selected-tags { display: flex; flex-wrap: wrap; gap: 6px; min-height: 28px; align-items: center; }
.selected-tags button { border-radius: 999px; }
.metadata-picker .picker-list { display: grid; gap: 8px; }
.metadata-picker .tag-option[aria-pressed='true'],
.metadata-picker .image-picker-item[aria-pressed='true'] { border-color: var(--accent); background: rgba(var(--accent-rgb), .14); }
.cover-preview { display: grid; grid-template-columns: 72px minmax(0, 1fr); gap: 10px; align-items: center; }
.cover-preview img { width: 72px; height: 52px; object-fit: cover; border-radius: 8px; }
```

扩展 `.field input` 的选择器为 `.field input, .field textarea, .field select`，确保 select 获得一致颜色、边框、focus 和 disabled 样式。移动端 media query 将封面预览和弹窗操作改为单列。

- [ ] **Step 4: Run all client-focused tests**

Run: `npm test -- --run tests/admin-client-editor.test.ts tests/admin-client-shell.test.ts tests/admin-client-visual.test.ts`

Expected: PASS.

- [ ] **Step 5: Run type and production builds**

Run: `npm run admin:check`

Expected: exit 0 with no TypeScript or Astro errors.

Run: `npm run admin:build`

Expected: exit 0 and refreshed `admin/client/dist` output; generated output must not be committed.

Run: `npm test -- --run`

Expected: all Vitest suites PASS.

Run: `npm run build`

Expected: exit 0 and Astro production build succeeds; generated `dist/` must not be committed.

- [ ] **Step 6: Review working tree and commit source/test changes only**

```powershell
git status --short
git diff --check
git add admin/client/src/styles.css tests/admin-client-visual.test.ts
git commit -m "style: tighten admin metadata forms"
```

确认没有暂存 `dist/`、`.astro/`、`.deploy/` 或 `admin/client/dist/`。
