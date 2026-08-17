# Clip Import File Types Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restrict clipboard imports to supported source/text extensions and preselect the matching editor language from the chosen filename.

**Architecture:** Keep the canonical extension-to-language map in the existing client language module, derive the file input `accept` value from it, and expose a pure filename detection helper. The clips page will use the helper for runtime validation and form initialization while leaving the existing language selector editable and leaving the server API unchanged.

**Tech Stack:** React 19, TypeScript 6, Astro admin client, Vitest 4, Testing Library, jsdom.

## Global Constraints

- Supported extensions are exactly `.txt`, `.ts`, `.js`, `.mjs`, `.cjs`, `.tsx`, `.jsx`, `.py`, `.c`, `.h`, `.cc`, `.cpp`, `.cxx`, `.hpp`, and `.hxx`.
- Extension matching is case-insensitive and uses the final filename extension.
- Unsupported, extensionless, and trailing-dot filenames must not open the import dialog.
- The automatically detected language remains editable in the existing import dialog.
- Do not change `/api/clips/import`, server MIME validation, content schemas, or add dependencies.
- Preserve unrelated uncommitted changes; stage or commit only files named in the task being completed.

---

### Task 1: Define and test the canonical file-language mapping

**Files:**
- Modify: `tests/admin-client-languages.test.ts`
- Modify: `admin/client/src/lib/languages.ts`

**Interfaces:**
- Produces: `CLIP_IMPORT_ACCEPT: string`
- Produces: `detectClipLanguage(filename: string): string | undefined`
- Mapping result values must match existing `CLIP_LANGUAGE_OPTIONS` values.

- [ ] **Step 1: Write failing mapping and detection tests**

Update the import in `tests/admin-client-languages.test.ts`:

```typescript
import {
  CLIP_IMPORT_ACCEPT,
  CLIP_LANGUAGE_OPTIONS,
  clipLanguageLabel,
  clipLanguageOptions,
  detectClipLanguage,
} from '../admin/client/src/lib/languages';
```

Add these tests inside the existing `describe` block:

```typescript
it('maps every supported source extension to an editor language', () => {
  expect(CLIP_IMPORT_ACCEPT).toBe(
    '.txt,.ts,.js,.mjs,.cjs,.tsx,.jsx,.py,.c,.h,.cc,.cpp,.cxx,.hpp,.hxx',
  );
  expect([
    ['notes.txt', 'text'],
    ['component.ts', 'typescript'],
    ['browser.js', 'javascript'],
    ['module.mjs', 'javascript'],
    ['config.cjs', 'javascript'],
    ['view.tsx', 'tsx'],
    ['widget.jsx', 'jsx'],
    ['script.py', 'python'],
    ['main.c', 'cpp'],
    ['header.h', 'cpp'],
    ['source.cc', 'cpp'],
    ['source.cpp', 'cpp'],
    ['source.cxx', 'cpp'],
    ['header.hpp', 'cpp'],
    ['header.hxx', 'cpp'],
  ].map(([filename, language]) => [filename, detectClipLanguage(filename)])).toEqual([
    ['notes.txt', 'text'],
    ['component.ts', 'typescript'],
    ['browser.js', 'javascript'],
    ['module.mjs', 'javascript'],
    ['config.cjs', 'javascript'],
    ['view.tsx', 'tsx'],
    ['widget.jsx', 'jsx'],
    ['script.py', 'python'],
    ['main.c', 'cpp'],
    ['header.h', 'cpp'],
    ['source.cc', 'cpp'],
    ['source.cpp', 'cpp'],
    ['source.cxx', 'cpp'],
    ['header.hpp', 'cpp'],
    ['header.hxx', 'cpp'],
  ]);
});

it('detects the final extension case-insensitively and rejects unsupported names', () => {
  expect(detectClipLanguage('archive.COMPONENT.TSX')).toBe('tsx');
  expect(detectClipLanguage('SCRIPT.Py')).toBe('python');
  expect(detectClipLanguage('README')).toBeUndefined();
  expect(detectClipLanguage('source.')).toBeUndefined();
  expect(detectClipLanguage('archive.zip')).toBeUndefined();
});
```

- [ ] **Step 2: Run the language tests and verify RED**

Run:

```bash
npm test -- --run tests/admin-client-languages.test.ts
```

Expected: FAIL because `CLIP_IMPORT_ACCEPT` and `detectClipLanguage` are not exported.

- [ ] **Step 3: Implement the minimal canonical mapping**

Add the following after `CLIP_LANGUAGE_OPTIONS` in `admin/client/src/lib/languages.ts`:

```typescript
const CLIP_LANGUAGE_BY_EXTENSION: Readonly<Record<string, string>> = {
  '.txt': 'text',
  '.ts': 'typescript',
  '.js': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.tsx': 'tsx',
  '.jsx': 'jsx',
  '.py': 'python',
  '.c': 'cpp',
  '.h': 'cpp',
  '.cc': 'cpp',
  '.cpp': 'cpp',
  '.cxx': 'cpp',
  '.hpp': 'cpp',
  '.hxx': 'cpp',
};

export const CLIP_IMPORT_ACCEPT = Object.keys(CLIP_LANGUAGE_BY_EXTENSION).join(',');

export function detectClipLanguage(filename: string): string | undefined {
  const extension = /\.[^.]+$/.exec(filename.trim())?.[0].toLowerCase();
  return extension ? CLIP_LANGUAGE_BY_EXTENSION[extension] : undefined;
}
```

- [ ] **Step 4: Run the language tests and verify GREEN**

Run:

```bash
npm test -- --run tests/admin-client-languages.test.ts
```

Expected: all tests in `admin-client-languages.test.ts` PASS with no warnings.

- [ ] **Step 5: Review and checkpoint Task 1**

Run:

```bash
git diff --check -- admin/client/src/lib/languages.ts tests/admin-client-languages.test.ts
git diff -- admin/client/src/lib/languages.ts tests/admin-client-languages.test.ts
```

Expected: no whitespace errors; diff contains only the mapping, exports, and focused tests. If creating a commit is appropriate in the current workspace, stage only these two files and use `feat: detect clipboard import languages`.

---

### Task 2: Restrict the picker and validate selected files

**Files:**
- Modify: `tests/admin-client-clips.test.tsx`
- Modify: `admin/client/src/pages/ClipsPage.tsx`

**Interfaces:**
- Consumes: `CLIP_IMPORT_ACCEPT: string`
- Consumes: `detectClipLanguage(filename: string): string | undefined`
- Existing `ClipImportFields.language` continues to receive one of the existing language option values.

- [ ] **Step 1: Write failing page interaction tests**

Add this helper after `renderPage` in `tests/admin-client-clips.test.tsx`:

```typescript
function importInput(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error('Expected clipboard import file input');
  return input;
}
```

Add these tests inside the existing `describe` block:

```typescript
it('limits the picker and preselects the language from a supported file', async () => {
  apiMocks.listClips.mockResolvedValue(page([]));
  const { container } = renderPage();
  const input = importInput(container);

  expect(input).toHaveAttribute(
    'accept',
    '.txt,.ts,.js,.mjs,.cjs,.tsx,.jsx,.py,.c,.h,.cc,.cpp,.cxx,.hpp,.hxx',
  );

  fireEvent.change(input, {
    target: { files: [new File(['const value = 1;'], 'sample.component.TSX', { type: 'text/plain' })] },
  });

  expect(await screen.findByRole('heading', { name: '导入剪切内容' })).toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: '标题' })).toHaveValue('sample.component');
  expect(screen.getAllByRole('combobox', { name: '语言' })).toHaveLength(2);
  expect(screen.getAllByRole('combobox', { name: '语言' })[1]).toHaveTextContent('TSX');
});

it('keeps the detected language editable before import', async () => {
  apiMocks.listClips.mockResolvedValue(page([]));
  const { container } = renderPage();

  fireEvent.change(importInput(container), {
    target: { files: [new File(['print(1)'], 'script.py', { type: 'text/plain' })] },
  });

  const languageSelect = (await screen.findAllByRole('combobox', { name: '语言' }))[1];
  expect(languageSelect).toHaveTextContent('Python');
  fireEvent.click(languageSelect);
  fireEvent.click(screen.getByRole('option', { name: '纯文本' }));
  expect(languageSelect).toHaveTextContent('纯文本');
});

it('rejects unsupported files without opening the import dialog', async () => {
  apiMocks.listClips.mockResolvedValue(page([]));
  const { container } = renderPage();
  const input = importInput(container);

  fireEvent.change(input, {
    target: { files: [new File(['binary'], 'archive.zip', { type: 'application/zip' })] },
  });

  expect(await screen.findByRole('status')).toHaveTextContent('不支持文件类型：archive.zip');
  expect(screen.queryByRole('heading', { name: '导入剪切内容' })).not.toBeInTheDocument();
  expect(input.value).toBe('');
  expect(apiMocks.importClip).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the clips page tests and verify RED**

Run:

```bash
npm test -- --run tests/admin-client-clips.test.tsx
```

Expected failures:
- the file input has no `accept` attribute;
- selected `.TSX` and `.py` files still initialize as `text`;
- `.zip` opens the import dialog instead of showing an error.

- [ ] **Step 3: Import the mapping helpers in the page**

Replace the existing language import in `admin/client/src/pages/ClipsPage.tsx` with:

```typescript
import {
  CLIP_IMPORT_ACCEPT,
  clipLanguageLabel,
  detectClipLanguage,
} from '../lib/languages';
```

- [ ] **Step 4: Validate and initialize the selected file**

Replace `selectImportFile` with:

```typescript
const selectImportFile = (event: ChangeEvent<HTMLInputElement>) => {
  const file = event.target.files?.[0];
  if (!file) return;
  const detectedLanguage = detectClipLanguage(file.name);
  if (!detectedLanguage) {
    setImportFile(undefined);
    setImportFields(emptyImportFields());
    setMessage(`不支持文件类型：${file.name}。请选择受支持的源码或纯文本文件。`);
    event.target.value = '';
    return;
  }
  setMessage(undefined);
  setImportFile(file);
  setImportFields({
    ...emptyImportFields(),
    title: file.name.replace(/\.[^.]+$/, ''),
    language: detectedLanguage,
  });
};
```

- [ ] **Step 5: Restrict the native file picker**

Change the hidden file input to:

```tsx
<input
  ref={importInput}
  className="visually-hidden-input"
  type="file"
  accept={CLIP_IMPORT_ACCEPT}
  onChange={selectImportFile}
/>
```

- [ ] **Step 6: Run the clips page tests and verify GREEN**

Run:

```bash
npm test -- --run tests/admin-client-clips.test.tsx
```

Expected: all clipboard list tests PASS with no warnings.

- [ ] **Step 7: Run focused regression tests**

Run:

```bash
npm test -- --run tests/admin-client-languages.test.ts tests/admin-client-clips.test.tsx tests/admin-client-editor.test.ts tests/admin-client-source.test.ts
```

Expected: all focused admin client tests PASS.

- [ ] **Step 8: Review and checkpoint Task 2**

Run:

```bash
git diff --check -- admin/client/src/pages/ClipsPage.tsx tests/admin-client-clips.test.tsx
git diff -- admin/client/src/pages/ClipsPage.tsx tests/admin-client-clips.test.tsx
```

Expected: no whitespace errors and no unrelated list-page edits are overwritten. If creating a commit is appropriate in the current workspace, stage only these two files plus the Task 1 files and use `fix: restrict clipboard import file types`.

---

### Task 3: Verify the complete change

**Files:**
- Verify only: `admin/client/src/lib/languages.ts`
- Verify only: `admin/client/src/pages/ClipsPage.tsx`
- Verify only: `tests/admin-client-languages.test.ts`
- Verify only: `tests/admin-client-clips.test.tsx`

**Interfaces:**
- Verifies the public exports and page behavior created by Tasks 1 and 2.

- [ ] **Step 1: Run the full Vitest suite once**

Run:

```bash
npm test -- --run
```

Expected: complete Vitest suite PASS.

- [ ] **Step 2: Run TypeScript and Astro validation**

Run:

```bash
npm run check
npm run admin:check
```

Expected: both commands exit successfully with no TypeScript or Astro errors.

- [ ] **Step 3: Build the production outputs**

Run:

```bash
npm run build
npm run admin:build
```

Expected: both production builds exit successfully.

- [ ] **Step 4: Inspect the final scoped diff**

Run:

```bash
git diff --check -- admin/client/src/lib/languages.ts admin/client/src/pages/ClipsPage.tsx tests/admin-client-languages.test.ts tests/admin-client-clips.test.tsx
git status --short
```

Expected: no whitespace errors; the four implementation/test files contain only the requested feature changes, while pre-existing unrelated modifications remain untouched.
