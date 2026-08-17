# Clip Insertion Root Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make article-to-Clip insertion a server-authoritative transaction with visible failures, correct slug references, stable cursor placement, and a single dialog scrollbar.

**Architecture:** The client captures the CodeMirror insertion offset before opening the picker, persists the draft, and calls the existing Clip-reference endpoint. The server validates and writes `slug` reference Markdown atomically and returns the updated post, which becomes the only success signal used by the client.

**Tech Stack:** React 19, TypeScript, CodeMirror 6, Fastify, Astro content repository, Vitest, CSS.

## Global Constraints

- Do not overwrite or revert unrelated uncommitted workspace changes.
- Do not generate Clip reference Markdown in `PostEditorPage`; the server is the only write authority.
- Do not close the picker or show success until the server returns the updated post.
- Preserve the historical comparison dialog's specialized independent scrolling.
- Do not create commits while the relevant files contain pre-existing uncommitted user changes; report the changed files instead.

---

## File Map

- `admin/server/content/transactions.ts`: validate and atomically attach a Clip, returning the updated stored post.
- `admin/server/routes/clips.ts`: expose the updated post as the attach endpoint response.
- `admin/client/src/api/clips.ts`: type the attach request as returning `PostDocument`.
- `admin/client/src/pages/PostEditorPage.tsx`: capture cursor offset, invoke the transaction, synchronize returned post/revision, and surface failures.
- `admin/client/src/lib/editor-actions.ts`: remove obsolete client-side Clip Fence construction if no remaining callers exist.
- `admin/client/src/styles.css`: make `.picker-list` the sole scroll owner for the Clip picker.
- `tests/independent-assets.test.ts`: transaction-level return and insertion contract.
- `tests/admin-api-contract.test.ts`: HTTP response contract.
- `tests/admin-client-editor.test.ts`: client helper/source behavior regression.
- `tests/admin-client-source.test.ts`: no silent insertion path and single-scroll CSS contract.

---

### Task 1: Make the attach transaction return the updated article

**Files:**
- Modify: `admin/server/content/transactions.ts`
- Modify: `admin/server/routes/clips.ts`
- Test: `tests/independent-assets.test.ts`
- Test: `tests/admin-api-contract.test.ts`

**Interfaces:**
- Produces: `attachClipToPostTransaction(...): Promise<StoredPostDocument>`
- Produces: `POST /api/posts/:postSlug/clip-references` response body `PostDocument` with `revision`

- [ ] **Step 1: Write a failing transaction test**

Import `attachClipToPostTransaction`, create a post and Clip, attach at a known offset, and assert that the returned document contains the slug reference and a changed revision:

```ts
const before = await repository.createPost(post('owner', 'before\nafter\n'));
await repository.createClip('shared-answer', {
  title: 'Shared answer',
  language: 'typescript',
  file: 'answer.ts',
  createdAt: '2026-08-17',
}, 'export const answer = 42;\n');

const updated = await attachClipToPostTransaction(
  repository,
  'owner',
  'shared-answer',
  { expectedPostRevision: before.revision, insertOffset: 7 },
);

expect(updated.body).toBe('before\n```clip\nslug: shared-answer\n```\nafter\n');
expect(updated.revision).not.toBe(before.revision);
```

- [ ] **Step 2: Run the transaction test and verify RED**

Run:

```powershell
npm test -- --run tests/independent-assets.test.ts
```

Expected: FAIL because `attachClipToPostTransaction` currently returns `void`.

- [ ] **Step 3: Write a failing API contract assertion**

Extend the existing API fixture test to create an independent Clip and POST its reference:

```ts
const attached = await app.inject({
  method: 'POST',
  url: '/api/posts/owner/clip-references',
  headers: writeHeaders,
  payload: {
    clipSlug: 'sample',
    expectedPostRevision: owner.json().revision,
    insertOffset: owner.json().body.length,
  },
});

expect(attached.statusCode, attached.body).toBe(200);
expect(attached.json()).toMatchObject({
  slug: 'owner',
  body: expect.stringContaining('slug: sample'),
});
expect(attached.json().revision).not.toBe(owner.json().revision);
```

- [ ] **Step 4: Run the API test and verify RED**

Run:

```powershell
npm test -- --run tests/admin-api-contract.test.ts
```

Expected: FAIL because the endpoint currently returns `{ ok: true }`.

- [ ] **Step 5: Return the repository update result from the transaction**

Change the signature and return the updated stored article:

```ts
import type { ClipDocument, ClipMetadata, StoredPostDocument } from '../../shared/content-types';

export async function attachClipToPostTransaction(
  repository: ContentRepository,
  postSlug: string,
  clipSlug: string,
  options: { expectedPostRevision: string; insertOffset?: number },
): Promise<StoredPostDocument> {
  await repository.readClip(clipSlug);
  const post = await repository.readPost(postSlug);
  if (post.revision !== options.expectedPostRevision) {
    throw new ContentConflictError('Post revision does not match expectedPostRevision.');
  }
  const body = insertFence(post.body, serializeClipReference(clipSlug), options.insertOffset);
  return repository.updatePost(
    post.slug,
    { ...post, body },
    { expectedRevision: post.revision },
  );
}
```

- [ ] **Step 6: Return the transaction result from the route**

```ts
return attachClipToPostTransaction(repository, postSlug, body.clipSlug, {
  expectedPostRevision: body.expectedPostRevision,
  insertOffset: body.insertOffset,
});
```

- [ ] **Step 7: Run focused server tests and verify GREEN**

Run:

```powershell
npm test -- --run tests/independent-assets.test.ts tests/admin-api-contract.test.ts
```

Expected: both files PASS, including missing Clip, revision conflict, and invalid offset behavior already enforced by the transaction.

---

### Task 2: Replace silent client insertion with the server response contract

**Files:**
- Modify: `admin/client/src/api/clips.ts`
- Modify: `admin/client/src/pages/PostEditorPage.tsx`
- Modify: `admin/client/src/lib/editor-actions.ts`
- Test: `tests/admin-client-editor.test.ts`
- Test: `tests/admin-client-source.test.ts`

**Interfaces:**
- Consumes: attach endpoint returning `PostDocument`
- Produces: `attachClipToPost(...): Promise<PostDocument>`
- Produces: `clipInsertOffsetRef: MutableRefObject<number | null>` and `clipInsertBusy: boolean`

- [ ] **Step 1: Add failing client source assertions**

Add assertions that describe the non-silent flow:

```ts
expect(page).toContain('const clipInsertOffsetRef = useRef<number | null>(null)');
expect(page).toContain('const [clipInsertBusy, setClipInsertBusy] = useState(false)');
expect(page).toContain('clipInsertOffsetRef.current = editor.getSelectionOffset()');
expect(page).toContain('const updated = await api.attachClipToPost(');
expect(page).toContain('setDraft(postToInput(updated))');
expect(page).toContain('revisionRef.current = updated.revision');
expect(page).toContain('setRevision(updated.revision)');
expect(page).not.toContain('editor?.insertText(createClipFence');
expect(page).not.toContain('if (!clip) return');
expect(page).not.toContain("import { createClipFence");
```

Add an API typing assertion:

```ts
expect(clipsApi).toContain('request<PostDocument>');
```

- [ ] **Step 2: Run focused client tests and verify RED**

Run:

```powershell
npm test -- --run tests/admin-client-editor.test.ts tests/admin-client-source.test.ts
```

Expected: FAIL because the current page performs local optional-chained insertion and the API returns `{ ok: true }`.

- [ ] **Step 3: Type the API response as an updated article**

```ts
import type { ClipDocument, ClipPageResult, ClipSaveInput, PostDocument } from '../types';

attachClipToPost: (
  postSlug: string,
  clipSlug: string,
  postRevision: string,
  insertOffset: number,
) => request<PostDocument>(`/posts/${encodeURIComponent(postSlug)}/clip-references`, {
  method: 'POST',
  body: { clipSlug, expectedPostRevision: postRevision, insertOffset },
}),
```

- [ ] **Step 4: Capture the cursor before opening the modal**

Add dedicated state and ref:

```ts
const [clipInsertBusy, setClipInsertBusy] = useState(false);
const clipInsertOffsetRef = useRef<number | null>(null);
```

Replace `openClipPicker` with an error-visible implementation:

```ts
const openClipPicker = async () => {
  if (!editor) {
    setMessage('正文编辑器尚未就绪，请稍后重试。');
    return;
  }
  clipInsertOffsetRef.current = editor.getSelectionOffset();
  setMessage(undefined);
  try {
    if (!clips.length) setClips((await api.listClips()).items);
    setShowClipPicker(true);
  } catch (reason) {
    setMessage(reason instanceof Error ? reason.message : 'Clip 列表加载失败');
  }
};
```

- [ ] **Step 5: Replace local insertion with the server transaction**

```ts
const insertExistingClip = async (clip: ClipSummary) => {
  const insertOffset = clipInsertOffsetRef.current;
  if (insertOffset === null) {
    setMessage('无法确定 Clip 插入位置，请关闭窗口后重试。');
    return;
  }

  setClipInsertBusy(true);
  setMessage(undefined);
  try {
    const savedPost = await persistDraft(`resource-${crypto.randomUUID()}`);
    const updated = await api.attachClipToPost(
      savedPost.slug,
      clip.slug,
      savedPost.revision,
      insertOffset,
    );
    setDraft(postToInput(updated));
    revisionRef.current = updated.revision;
    setRevision(updated.revision);
    setLoadBaselineKey(updated.revision);
    clipInsertOffsetRef.current = null;
    setShowClipPicker(false);
    setClipQuery('');
    setMessage(`已插入 Clip：${clip.file}`);
  } catch (reason) {
    setMessage(reason instanceof Error ? reason.message : '插入 Clip 失败');
  } finally {
    setClipInsertBusy(false);
  }
};
```

Change the list button to pass the displayed object directly and await the operation:

```tsx
<button
  type="button"
  key={clip.slug}
  disabled={clipInsertBusy}
  onClick={() => void insertExistingClip(clip)}
>
```

Reset the stored offset only on explicit dialog close or successful insertion:

```tsx
onClose={() => {
  if (clipInsertBusy) return;
  clipInsertOffsetRef.current = null;
  setShowClipPicker(false);
  setClipQuery('');
}}
```

- [ ] **Step 6: Remove obsolete client-side Clip Fence generation**

Search first:

```powershell
rg -n "createClipFence|ClipFenceInput" admin tests
```

If `PostEditorPage` and its tests are the only remaining consumers, remove `ClipFenceInput` and `createClipFence` from `admin/client/src/lib/editor-actions.ts`, then replace the old helper test with assertions covering the server-generated `slug` reference contract.

- [ ] **Step 7: Run focused client tests and verify GREEN**

Run:

```powershell
npm test -- --run tests/admin-client-editor.test.ts tests/admin-client-source.test.ts
```

Expected: PASS; no client-side Clip Fence creation or optional-chained insertion remains.

---

### Task 3: Remove nested scrolling and verify the complete workflow

**Files:**
- Modify: `admin/client/src/styles.css`
- Test: `tests/admin-client-source.test.ts`
- Test: `tests/admin-client-visual.test.ts`

**Interfaces:**
- Consumes: `.picker-list` as the ordinary dialog scroll owner
- Produces: `.clip-reuse-index` layout without `max-height` or `overflow`

- [ ] **Step 1: Add a failing CSS regression test**

```ts
const clipIndexRule = styles.match(/\.clip-reuse-index\s*\{([^}]*)\}/)?.[1] ?? '';
expect(clipIndexRule).not.toMatch(/overflow\s*:/);
expect(clipIndexRule).not.toMatch(/max-height\s*:/);
expect(styles).toMatch(/\.picker-list\s*\{[^}]*overflow-y:\s*auto/);
expect(styles).toMatch(/\.history-dialog \.picker-list\s*\{[^}]*overflow:\s*hidden/);
```

- [ ] **Step 2: Run the CSS test and verify RED**

Run:

```powershell
npm test -- --run tests/admin-client-source.test.ts tests/admin-client-visual.test.ts
```

Expected: FAIL because `.clip-reuse-index` currently declares `max-height: 52vh; overflow: auto`.

- [ ] **Step 3: Remove the nested Clip-list scroll context**

Replace:

```css
.clip-reuse-index { max-height: 52vh; overflow: auto; padding-top: 0; border-top: 0; }
```

with:

```css
.clip-reuse-index { padding-top: 0; border-top: 0; }
```

Do not change:

```css
.picker-list { max-height: 560px; overflow-y: auto; }
.history-dialog .picker-list { max-height: none; min-height: 0; overflow: hidden; }
```

- [ ] **Step 4: Run focused tests and verify GREEN**

Run:

```powershell
npm test -- --run tests/admin-client-source.test.ts tests/admin-client-visual.test.ts
```

Expected: PASS with one ordinary picker scrollbar and unchanged history-dialog scrolling.

- [ ] **Step 5: Run all repository verification commands**

Run:

```powershell
npm test -- --run
npm run check
npm run build
```

Expected: all commands exit with code 0. If any pre-existing failure occurs, record the exact failing test or diagnostic and distinguish it from this change.

- [ ] **Step 6: Review the final diff without staging unrelated work**

Run:

```powershell
git diff -- admin/server/content/transactions.ts admin/server/routes/clips.ts admin/client/src/api/clips.ts admin/client/src/pages/PostEditorPage.tsx admin/client/src/lib/editor-actions.ts admin/client/src/styles.css tests/independent-assets.test.ts tests/admin-api-contract.test.ts tests/admin-client-editor.test.ts tests/admin-client-source.test.ts tests/admin-client-visual.test.ts
git status --short
```

Expected: only intended hunks are attributable to this fix; unrelated pre-existing modifications remain untouched and unstaged.
