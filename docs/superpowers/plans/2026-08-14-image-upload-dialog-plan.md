# Image Upload Dialog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the disabled image-library upload button flow with a modal that collects the owner post slug and one or more image files before uploading.

**Architecture:** Keep the existing `api.uploadImage(file, ownerPostSlug)` contract. `ImagesPage` owns modal state and renders a small local `ImageUploadDialog`; existing dialog design tokens/classes are reused, with a few upload-specific styles appended to the admin stylesheet.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, existing admin CSS.

## Global Constraints

- Do not change the server upload endpoint or image processing behavior.
- Keep image-library filtering state separate from upload form state.
- Support multiple JPEG, PNG, or WebP files.
- Do not start a persistent development server.

---

### Task 1: Lock the modal interaction contract

**Files:**
- Modify: `tests/admin-preview-regressions.test.ts`
- Modify: `admin/client/src/pages/ImagesPage.tsx`

**Interfaces:**
- Consumes: `api.uploadImage(file: File, ownerPostSlug: string)`
- Produces: `ImageUploadDialog` and modal state owned by `ImagesPage`

- [ ] **Step 1: Write the failing source contract test**

Assert that `ImagesPage.tsx` contains `ImageUploadDialog`, separate `uploadOwner` and `selectedFiles` state, and no longer contains the old `chooseFiles`/disabled-by-filter behavior.

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `npm test -- --run tests/admin-preview-regressions.test.ts -t "opens an upload dialog"`
Expected: FAIL because the modal component/state does not exist.

- [ ] **Step 3: Implement modal state and upload flow**

Add `showUpload`, `uploadOwner`, `selectedFiles`, `uploadError`, and `uploading` state. Open the modal from the page-header button, prefill `uploadOwner` from the current filter, validate both fields on submit, upload sequentially through the existing API, close on success, and retain state on failure.

- [ ] **Step 4: Run the focused test**

Run: `npm test -- --run tests/admin-preview-regressions.test.ts -t "opens an upload dialog"`
Expected: PASS.

### Task 2: Style and verify the upload dialog

**Files:**
- Modify: `admin/client/src/styles.css`
- Test: `tests/admin-preview-regressions.test.ts`

**Interfaces:**
- Consumes: existing `.dialog-scrim`, `.picker-dialog`, `.field`, and button styles
- Produces: `.image-upload-dialog`, `.image-upload-dropzone`, and `.selected-file-list`

- [ ] **Step 1: Add responsive modal styles**

Keep the dialog within `min(620px, 100%)`, make the file selector a dashed full-width target, and render selected filenames in a scrollable compact list.

- [ ] **Step 2: Run targeted tests and type validation**

Run: `npm test -- --run tests/admin-preview-regressions.test.ts tests/admin-client-source.test.ts`
Expected: all selected tests pass.

Run: `npm run admin:check`
Expected: 0 errors, 0 warnings, 0 hints.