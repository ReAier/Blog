# Admin Modal Frosted Glass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将后台所有基于共享 `Dialog` 的居中模态弹窗统一为与博客后台协调的主题感磨砂玻璃材质，同时保持现有内容布局、交互和可访问性。

**Architecture:** 继续以 `admin/client/src/components/Dialog.tsx` 输出的 `.dialog-scrim` / `.picker-dialog` 作为统一外壳边界；在 `theme.css` 增加主题化 modal glass 语义变量，在 `styles.css` 由共享 shell 使用这些变量、模糊、饱和度、内高光和回退背景。确认弹窗、图片上传、剪贴导入、标签/封面选择与历史对比弹窗只保留自己的尺寸和内容结构，不再各自实现不透明的外壳材质。

**Tech Stack:** React 19, TypeScript, Vite, CSS custom properties, Vitest, Astro 7

## Global Constraints

- 仅修改共用 `Dialog` 的居中模态弹窗；不修改外观设置浮层、下拉菜单、日历、提示和普通卡片。
- 复用现有后台 glass material 语言；不引入新的独立视觉系统或重复的大段材质公式。
- 保留现有业务逻辑、焦点陷阱、初始焦点、焦点恢复、Escape、遮罩点击、滚动锁定和响应式布局。
- 保留明暗主题的文字对比、粉色主操作色和红色危险操作语义。
- 不修改 `dist/`、`.astro/`、`.deploy/` 等生成目录。
- 保留工作区中与本任务无关的已有未提交修改。
- 每个生产代码变化先有针对性测试契约，再运行测试验证。

## File Map

- `admin/client/src/styles/theme.css`: 增加 light/dark modal glass surface、fallback、border、highlight、shadow、scrim、blur 和 saturation 变量。
- `admin/client/src/styles.css`: 将共享 `.dialog-scrim` 和 `.picker-dialog` 改为主题化磨砂玻璃；移除/覆盖旧的 solid dialog shell；为 shared header/body/footer 分区提供低透明度分隔和 fallback；保留各专用弹窗的尺寸与内容规则。
- `tests/admin-client-visual.test.ts`: 增加 modal shell 的主题变量、blur/saturation、fallback、旧 solid surface 不回归、以及外观面板未被 modal 选择器耦合的源码契约。
- `tests/admin-preview-regressions.test.ts`: 保留并补充图片上传/共享 Dialog 使用契约，确保专用弹窗仍然挂在 shared shell 上。
- `admin/client/src/components/Dialog.tsx`: 仅在测试证明需要时修改；默认不改逻辑，避免触碰已经验证过的可访问性行为。
- `admin/client/src/context/ConfirmDialogContext.tsx`: 仅在测试证明需要时修改；默认不改确认弹窗内容和语义。

---

### Task 1: Add failing visual contracts for the modal material

**Files:**
- Modify: `tests/admin-client-visual.test.ts`
- Modify: `tests/admin-preview-regressions.test.ts` only if a focused shared-Dialog regression belongs there

**Interfaces:**
- Consumes: Existing `read()` and `readProjectFile()` test helpers.
- Produces: Red tests that describe the required shared modal selectors and theme tokens.

- [ ] **Step 1: Write the failing tests**

Add a `describe('admin modal frosted glass contract', ...)` block that reads `styles.css` and `styles/theme.css` and asserts:

- both `:root[data-theme='light']` and `:root[data-theme='dark']` define the modal surface and no-filter fallback tokens;
- `.dialog-scrim` uses the modal scrim token plus `backdrop-filter` and `-webkit-backdrop-filter` with modal blur/saturation tokens;
- `.picker-dialog` uses the modal glass surface, border, inset highlight, radius, and shadow tokens;
- the shared shell does not use `var(--dialog-surface-solid)` as its background;
- an `@supports not` fallback targets `.dialog-scrim` / `.picker-dialog` without requiring backdrop blur;
- `.appearance-panel` remains outside the shared modal selector rule and its existing visual selector is still present.

Add a focused source assertion that representative consumers (`ConfirmDialogContext.tsx`, `ImagesPage.tsx`, `ClipImportDialog.tsx`, and `PostMetadataPickers.tsx`) still render `<Dialog`.

- [ ] **Step 2: Run the targeted tests and verify they fail**

Run:

```powershell
npm test -- --run tests/admin-client-visual.test.ts tests/admin-preview-regressions.test.ts
```

Expected: the new modal contract fails because the shared shell still points at the old solid surface and the new modal tokens/formulas do not yet exist.

- [ ] **Step 3: Review the failure against the design spec**

Confirm the failure is limited to missing modal material contracts, not unrelated existing uncommitted work. Do not weaken the assertions to match the old solid dialog.

---

### Task 2: Define theme-aware modal glass tokens

**Files:**
- Modify: `admin/client/src/styles/theme.css`

**Interfaces:**
- Consumes: Existing `--article-glass-*`, `--glass-*`, `--dialog-*`, `--scrim`, and theme variables.
- Produces: `--modal-glass-surface`, `--modal-glass-fallback`, `--modal-glass-border`, `--modal-glass-highlight`, `--modal-glass-shadow`, `--modal-scrim`, `--modal-glass-blur`, and `--modal-glass-saturation` in both light and dark theme blocks.

- [ ] **Step 1: Add light-theme modal tokens**

Use a pale translucent surface that preserves the light admin canvas behind it, a stronger opaque fallback, a low-opacity dark border, a restrained inset highlight, and a soft shadow. Keep accent color out of the base surface token so the shell remains editorial rather than pink.

- [ ] **Step 2: Add dark-theme modal tokens**

Use a dark translucent surface with readable warm-white text, a stronger light border, a dark opaque fallback, subtle white inset highlight, and a broad dark shadow. Use the existing accent RGB only for the shell's restrained gradient layer.

- [ ] **Step 3: Run the targeted test and inspect token failures**

Run the targeted command from Task 1. Expected: token assertions pass while shell-selector assertions remain red.

---

### Task 3: Implement the shared frosted-glass modal shell

**Files:**
- Modify: `admin/client/src/styles.css`

**Interfaces:**
- Consumes: Modal tokens from Task 2 and existing `.dialog-scrim`, `.picker-dialog`, `.picker-dialog > header`, `.confirm-dialog`, `image-upload-dialog`, `clip-import-dialog`, `history-dialog`, and picker layout selectors.
- Produces: A shared modal material inherited by every `Dialog` consumer.

- [ ] **Step 1: Replace the theme-layer shell background and scrim rules**

Update the theme-aware rules so `.dialog-scrim` uses the modal scrim token, modal blur/saturation, and a browser-prefixed blur declaration. Update `.picker-dialog` to use the modal glass surface, border, radius, shadow, and layered accent-tinted background. Keep `overflow: hidden`, width constraints, and stacking order unchanged.

- [ ] **Step 2: Add subtle shared shell depth details**

Use a pseudo-element or equivalent existing selector strategy to provide a low-opacity top inset highlight and restrained accent wash without intercepting pointer events. Ensure dialog content stays positioned above the decorative layer.

- [ ] **Step 3: Soften shared section separators**

Retain clear header/body/footer boundaries using `var(--line)` or a modal-specific separator token at low opacity. Do not alter the internal content grid, list scroll containers, or button semantics.

- [ ] **Step 4: Add no-backdrop-filter fallback**

Under `@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)))`, set `.dialog-scrim` and `.picker-dialog` to their opaque-enough fallback surfaces while retaining borders and shadows.

- [ ] **Step 5: Neutralize old component-level solid shell overrides**

Ensure the theme-layer `.picker-dialog` rule no longer restores `var(--dialog-surface-solid)` and that specialized dialogs do not override the shared shell background, blur, or shadow. Keep specialized geometry rules intact.

- [ ] **Step 6: Run targeted tests and inspect the diff**

Run:

```powershell
npm test -- --run tests/admin-client-visual.test.ts tests/admin-preview-regressions.test.ts
```

Expected: all targeted modal contracts pass. Inspect the diff to confirm no selectors for `.appearance-panel`, `.settings-menu`, or unrelated controls were changed.

---

### Task 4: Verify component coverage and responsive/accessibility preservation

**Files:**
- Inspect: `admin/client/src/components/Dialog.tsx`
- Inspect: `admin/client/src/context/ConfirmDialogContext.tsx`
- Inspect: `admin/client/src/components/ClipImportDialog.tsx`
- Inspect: `admin/client/src/components/PostMetadataPickers.tsx`
- Inspect: `admin/client/src/pages/ImagesPage.tsx`
- Inspect: `admin/client/src/pages/PostEditorPage.tsx`
- Modify: tests only if a regression contract is missing

**Interfaces:**
- Consumes: Shared shell from Task 3.
- Produces: Evidence that all centered modal consumers inherit the same material and all behavior remains unchanged.

- [ ] **Step 1: Enumerate every Dialog consumer**

Run:

```powershell
rg -n '<Dialog' admin/client/src --glob '*.tsx'
```

Compare the result with the design spec. Confirm the appearance panel is not a `Dialog` consumer.

- [ ] **Step 2: Inspect accessibility and close behavior**

Verify `Dialog.tsx` still contains `aria-modal`, labelled-by, described-by wiring, Tab trapping, Escape handling, backdrop handling, scroll locking, and focus restoration. Verify no code change is needed.

- [ ] **Step 3: Check responsive overrides**

Confirm the existing mobile rules for `.confirm-dialog`, `.image-upload-dialog`, `.clip-import-dialog`, and picker dialogs remain active, especially stacked footer actions and viewport width limits.

- [ ] **Step 4: Run focused source-contract tests**

Run:

```powershell
npm test -- --run tests/admin-client-visual.test.ts tests/admin-preview-regressions.test.ts tests/admin-client-source.test.ts
```

Expected: PASS with no modal behavior regressions.

---

### Task 5: Run full verification and visual QA

**Files:**
- No planned production changes; only update tests if a real regression is discovered and the assertion belongs to this feature.

- [ ] **Step 1: Run the complete Vitest suite**

```powershell
npm test -- --run
```

Expected: exit code 0 and zero failed tests.

- [ ] **Step 2: Run admin type and Astro checks**

```powershell
npm run admin:check
```

Expected: exit code 0 with no TypeScript or Astro diagnostics.

- [ ] **Step 3: Build the admin client**

```powershell
npm run admin:build
```

Expected: exit code 0 and generated output only in the existing admin client dist directory; do not stage generated output.

- [ ] **Step 4: Build the public site**

```powershell
npm run build
```

Expected: exit code 0; no generated output is edited manually or committed.

- [ ] **Step 5: Perform representative browser visual QA**

Start the admin dev server with `npm run admin:dev` if needed and inspect:

- a primary confirmation modal;
- a danger confirmation modal;
- image upload or clip import;
- a tag/cover picker;
- wide history comparison;
- light theme and dark theme;
- narrow viewport.

Confirm glass translucency, readable contrast, no clipped content, intact scrolling, intact buttons, and no appearance-panel restyling.

- [ ] **Step 6: Review final diff and repository status**

Run:

```powershell
git diff -- admin/client/src/styles.css admin/client/src/styles/theme.css tests/admin-client-visual.test.ts tests/admin-preview-regressions.test.ts
git status --short
```

Confirm only intended files changed for this feature, generated output is not staged, and unrelated pre-existing changes remain untouched.

---

## Verification Checklist

- [ ] All centered `Dialog` consumers inherit the same modal glass shell.
- [ ] Appearance panel is excluded.
- [ ] Light and dark themes have readable modal surfaces.
- [ ] Backdrop blur and no-filter fallback are both defined.
- [ ] Old opaque modal shell is removed from the shared selector.
- [ ] Confirmation, picker, upload, import, and history dialog behavior is unchanged.
- [ ] Focus and ARIA contracts remain intact.
- [ ] Targeted tests pass.
- [ ] Full tests, admin check, admin build, and public build pass.
- [ ] Representative visual QA is complete.
