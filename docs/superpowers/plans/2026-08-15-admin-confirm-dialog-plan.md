# Admin Confirm Dialog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Replace all eight native browser confirmations in the admin client with one accessible, visually consistent site-owned confirmation dialog.

**Architecture:** Add a root-level React context/provider exposing an asynchronous confirmation function. The provider owns dialog state, keyboard/backdrop cancellation, focus management, and visual tone; page handlers await the returned boolean before running their existing API operations.

**Tech Stack:** React 19, TypeScript, React Context, Testing Library, Vitest, CSS.

---

## File map

- Create `admin/client/src/context/ConfirmDialogContext.tsx`: provider, hook, option types, focus and keyboard behavior.
- Modify `admin/client/src/App.tsx`: wrap the router in the provider.
- Modify `admin/client/src/pages/BackupsPage.tsx`: replace backup confirmation.
- Modify `admin/client/src/pages/ClipEditorPage.tsx`: replace editor delete confirmation.
- Modify `admin/client/src/pages/ClipsPage.tsx`: replace list delete confirmation.
- Modify `admin/client/src/pages/ImagesPage.tsx`: replace image delete confirmation.
- Modify `admin/client/src/pages/PostsPage.tsx`: replace restore confirmation.
- Modify `admin/client/src/pages/PostEditorPage.tsx`: replace history restore and article delete confirmations.
- Modify `admin/client/src/pages/PublishPage.tsx`: replace publish confirmation.
- Modify `admin/client/src/styles.css`: add the editorial dark confirmation panel and danger action styling.
- Create `tests/admin-client-confirm-dialog.test.tsx`: provider interaction and accessibility tests.
- Modify `tests/admin-client-clips.test.tsx`: exercise the real site confirmation instead of mocking `window.confirm`.
- Modify `tests/admin-client-source.test.ts`: assert the admin source contains no native confirmation calls and includes the provider source in syntax checks.

### Task 1: Shared confirmation behavior

- [x] Write provider tests for primary confirmation, cancel, Escape, backdrop cancellation, default cancel focus, and trigger-focus restoration.
- [x] Run `npm test -- --run tests/admin-client-confirm-dialog.test.tsx` and verify failure because the provider does not exist.
- [x] Implement `ConfirmDialogProvider` and `useConfirmDialog` with `Promise<boolean>`, `role="alertdialog"`, labelled title/description, safe default focus, focus trapping/restoration, Escape and backdrop handling.
- [x] Add confirmation-dialog CSS aligned with the existing image-upload modal and reduced-motion behavior.
- [x] Re-run the provider tests and verify they pass.

### Task 2: Replace all native confirmations

- [x] Add source assertions that `admin/client/src` no longer contains `window.confirm` and that `App` mounts `ConfirmDialogProvider`.
- [x] Update the clipboard interaction test to open and operate the real confirmation dialog; verify cancellation skips deletion and confirmation invokes deletion.
- [x] Run the affected tests and verify failure while pages still call `window.confirm`.
- [x] Wrap `RouterProvider` in `ConfirmDialogProvider`.
- [x] Import and use `useConfirmDialog()` in all seven affected page files, passing explicit title, message, confirmation label, eyebrow, and primary/danger tone.
- [x] Re-run provider, clipboard, and source tests and verify they pass.

### Task 3: Full verification

- [x] Run `npm test -- --run`.
- [x] Run `npm run check`.
- [x] Run `npm run admin:check`.
- [x] Run `npm run build`.
- [x] Run `npm run admin:build`.
- [x] Search the admin source for `window.confirm`, `window.alert`, and `window.prompt`; expect no business calls.
- [x] Review the final changed files without committing or altering unrelated work in the shared dirty feature branch.