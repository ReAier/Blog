# 后台统一确认弹窗设计

日期：2026-08-15

## 目标

将后台全部 8 处 `window.confirm` 浏览器原生弹窗替换为与后台视觉系统一致的站内确认弹窗，不改变各业务操作原有的执行和错误处理逻辑。

## 架构

在后台客户端根节点增加 `ConfirmDialogProvider`，通过 `useConfirmDialog()` 暴露异步 `confirm(options): Promise<boolean>`。业务页面调用确认函数并等待用户选择：确认返回 `true`，取消、按 Escape 或点击遮罩返回 `false`。

Provider 同一时间只展示一个请求，并在组件卸载时安全结束未完成请求。弹窗使用 `role="alertdialog"`、`aria-modal="true"`、标题与描述关联，并将初始焦点放在“取消”按钮；关闭后恢复到触发确认操作的元素。

## 视觉与交互

弹窗沿用上传图片窗口的全屏遮罩、深色圆角面板、标题区、正文区与底部操作区。内容结构包含：

- 英文 eyebrow（例如 `Confirm action`）。
- 中文操作标题。
- 具体影响说明。
- 取消按钮。
- 明确的确认按钮文案。

删除文章、删除图片、删除剪切内容、应用备份等破坏性或覆盖性操作使用危险色确认按钮；恢复文章、恢复历史版本与发布操作使用现有粉色主按钮。危险确认按钮不自动获得焦点。

## 替换范围

- `BackupsPage.tsx`：应用已验证备份。
- `ClipEditorPage.tsx`：永久删除未引用剪切内容。
- `ClipsPage.tsx`：列表删除剪切内容。
- `ImagesPage.tsx`：删除图片。
- `PostsPage.tsx`：恢复文章。
- `PostEditorPage.tsx`：恢复历史版本、文章移入回收站。
- `PublishPage.tsx`：构建并切换线上版本。

## 测试与验收

- Provider 对确认、取消、Escape 和遮罩点击返回正确结果。
- 初始焦点位于取消按钮，弹窗关闭后恢复触发元素焦点。
- 全部后台业务源码不再包含 `window.confirm`。
- 各页面在取消时不调用 API，确认时保持原有 API 行为。
- 运行完整 Vitest、Astro/TypeScript 检查、公共站点构建和后台 Vite 构建。