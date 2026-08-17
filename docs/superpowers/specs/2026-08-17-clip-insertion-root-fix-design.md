# 文章编辑器 Clip 插入根因修复设计

**日期：** 2026-08-17  
**范围：** 管理后台文章编辑器中的已有 Clip 插入流程与选择弹窗滚动行为

## 问题与根因

当前文章编辑器把已有 Clip 作为旧版完整元数据 Fence 直接写入 CodeMirror。该实现绕过了已有的服务端关联事务，也存在两个静默分支：找不到 Clip 时直接返回，以及编辑器句柄为空时通过可选链跳过写入。随后界面仍可能关闭弹窗并显示成功。旧版 Fence 中的文件路径不符合独立 Clip 注册表结构，导致即时预览读取源码失败。

Clip 选择弹窗同时让外层 `.picker-list` 和内层 `.clip-reuse-index` 建立滚动上下文，因此显示两条纵向滚动条。

## 设计目标

- 服务端成为 Clip 引用写入的唯一权威入口。
- 插入成功必须意味着文章已经以正确的 `slug` 引用格式持久化。
- 所有失败都有可见反馈，不允许空返回、可选链吞错或虚假成功。
- 光标位置在打开弹窗时捕获，不受弹窗焦点切换影响。
- 一次插入只产生一个服务端更新结果，避免“写入后再次读取”的竞态。
- Clip 选择弹窗只有一个纵向滚动容器。

## 数据流

1. 用户点击“插入 Clip”。
2. 客户端确认 CodeMirror 句柄存在，并立即保存当前选区偏移；若不存在则不打开弹窗并显示错误。
3. 用户选择 Clip 后，按钮进入专用插入忙碌状态。
4. 客户端先持久化当前文章，取得确定的 slug 与最新 revision。
5. 客户端调用文章 Clip 关联接口，提交 Clip slug、文章 revision 和已捕获的插入偏移。
6. 服务端事务验证 Clip、文章 revision 和偏移范围，通过 `serializeClipReference(slug)` 生成引用并更新文章。
7. 服务端直接返回更新后的 `PostDocument`。
8. 客户端以响应同步正文和 revision；只有此时才关闭弹窗并显示成功。
9. 请求失败时保留弹窗、解除忙碌状态并显示实际错误。

## 接口与状态调整

- `attachClipToPostTransaction` 从 `Promise<void>` 改为返回更新后的文章文档。
- `/api/posts/:postSlug/clip-references` 返回该文章文档，不再只返回 `{ ok: true }`。
- 客户端 `attachClipToPost` 返回 `PostDocument`。
- 文章编辑器增加插入位置 ref 和 Clip 插入专用 busy 状态。
- 删除本流程对 `createClipFence` 和客户端本地 Fence 拼接的依赖；若没有其他调用，再删除废弃 helper 与类型。
- 不使用 `editor?.insertText()` 作为 Clip 关联写入路径。

## 错误与并发处理

- 编辑器未就绪：阻止打开弹窗并显示错误。
- Clip 不存在：服务端返回明确的 not-found 错误。
- revision 冲突：沿用统一 API 冲突错误，弹窗保持打开。
- 插入偏移越界：服务端返回 validation 错误，不修改文章。
- 保存失败或关联失败：不显示成功，不关闭弹窗。
- 重复点击：插入期间禁用 Clip 列表按钮。

## 滚动设计

`.picker-list` 是普通资源选择弹窗唯一的纵向滚动容器。`.clip-reuse-index` 只负责网格布局，移除 `max-height` 和 `overflow`。历史对比弹窗已有独立的特殊滚动布局，保持不变。

## 测试策略

- 单元测试：正确序列化 `slug` Clip 引用。
- 服务端事务测试：返回更新后的文章，并验证引用格式、偏移、revision 冲突和缺失 Clip。
- API 合约测试：关联接口返回更新后的 `PostDocument`。
- 客户端源码/组件测试：不再调用 `createClipFence`，捕获打开弹窗时的偏移，等待服务端响应后同步正文和 revision，失败时保留弹窗并显示错误。
- CSS 回归测试：`.clip-reuse-index` 不再声明滚动，`.picker-list` 保持唯一滚动。
- 最终运行 `npm test -- --run`、`npm run check` 和 `npm run build`。

## 非目标

- 不重构图片、标签、封面或历史弹窗。
- 不改变 Clip 注册表存储结构。
- 不改动文章发布流程。
- 不覆盖工作区中与本问题无关的未提交修改。
