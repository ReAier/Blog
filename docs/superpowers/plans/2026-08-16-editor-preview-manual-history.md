# Editor Preview and Manual History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复本站公网图片即时预览，并让文章历史只由手动保存生成，同时改善历史弹窗与保存状态 UI。

**Architecture:** 预览服务在 Markdown 渲染前规范化本站公网媒体 URL；保存 API 通过显式请求头区分手动与自动保存；历史接口返回解析后的正文；React 历史弹窗使用独立滚动容器。

**Tech Stack:** TypeScript、React 19、Fastify 5、Astro Markdown、Vitest。

## Global Constraints

- 不引入新依赖。
- 自动保存继续使用约 800ms 防抖。
- 外部图片 URL 不得被重写。
- 导入、删除、恢复和 slug 迁移历史保持不变。

---

### Task 1: 本站公网图片即时预览

**Files:**
- Modify: `admin/server/routes/previews.ts`
- Test: `tests/admin-preview-regressions.test.ts`

- [ ] 添加失败测试，验证本站 `/media/` 绝对 URL 被重写为后台媒体路径，外部 URL 保持不变。
- [ ] 运行测试确认失败。
- [ ] 实现 Markdown 图片 URL 规范化并接入即时预览。
- [ ] 运行测试确认通过。

### Task 2: 手动保存历史协议

**Files:**
- Modify: `admin/client/src/api/posts.ts`
- Modify: `admin/client/src/pages/PostEditorPage.tsx`
- Modify: `admin/server/routes/posts.ts`
- Test: `tests/admin-api-contract.test.ts`
- Test: `tests/admin-client-source.test.ts`

- [ ] 添加失败测试，验证自动更新不记录历史，带 manual 标记的保存记录历史。
- [ ] 运行测试确认失败。
- [ ] 实现手动保存请求标记以及服务端条件记录。
- [ ] 覆盖新文章自动创建与手动创建的历史行为。
- [ ] 运行测试确认通过。

### Task 3: 历史正文与独立滚动 UI

**Files:**
- Modify: `admin/server/routes/posts.ts`
- Modify: `admin/client/src/types.ts`
- Modify: `admin/client/src/pages/PostEditorPage.tsx`
- Modify: `admin/client/src/styles.css`
- Test: `tests/admin-client-source.test.ts`
- Test: `tests/admin-api-contract.test.ts`

- [ ] 添加失败测试，验证历史接口返回正文且 UI 不显示完整 frontmatter。
- [ ] 添加失败测试，验证按钮文案和左右独立滚动样式。
- [ ] 实现历史正文解析、按钮文案和滚动布局。
- [ ] 运行测试确认通过。

### Task 4: 删除 idle 保存文字

**Files:**
- Modify: `admin/client/src/pages/PostEditorPage.tsx`
- Modify: `admin/client/src/pages/ClipEditorPage.tsx`
- Test: `tests/admin-client-source.test.ts`

- [ ] 添加失败测试，禁止渲染“尚未修改”。
- [ ] 运行测试确认失败。
- [ ] 将 idle 状态映射为空内容。
- [ ] 运行相关测试、`npm run admin:check`、`npm test -- --run`、`npm run build`。
