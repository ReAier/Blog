# 备份文件数与回收站搜索 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复历史备份文件数显示为 0，并为回收站增加复用文章搜索材质的本地搜索。

**Architecture:** 在备份路由中为每个历史 ZIP 读取并校验 `manifest.json`，使用清单文件数量填充 `fileCount`，单个归档读取失败时安全回退且不影响其他记录。回收站继续使用现有一次性 API 数据，在 `TrashPage` 中以标题和详情做本地过滤，类型计数保持全量统计。

**Tech Stack:** Astro 7、React、TypeScript、Fastify、JSZip、Vitest。

---

### Task 1: 为历史备份文件数添加回归测试

**Files:**
- Modify: `tests/admin-api-contract.test.ts` 或现有备份 API 测试文件中的备份列表测试区域
- Modify: `tests/admin-backup-redirects.test.ts`（仅在需要复用 ZIP 工具时）
- Modify: `admin/server/routes/backups.ts`

- [ ] **Step 1: 写失败测试**

构造一个包含 `manifest.json` 和两个内容文件的历史 ZIP，放入测试配置的 `jobsRoot/backups`，调用 `GET /api/backups`，断言记录的 `fileCount` 为 `2`，而不是 `0`。再增加一个清单损坏的 ZIP，断言列表仍成功返回该记录，并使用安全回退值。

- [ ] **Step 2: 运行测试确认失败**

运行：`npm test -- --run tests/admin-api-contract.test.ts`

预期：新增正常 ZIP 测试因当前返回 `fileCount: 0` 失败；损坏清单测试应先确认当前实现是否会抛错，若当前仍返回 0，则以新增断言作为预期失败点。

- [ ] **Step 3: 实现最小修复**

在 `admin/server/routes/backups.ts` 中增加只读历史 ZIP 清单的辅助逻辑，使用项目已有 ZIP 依赖解析归档，读取 `manifest.json`，确认 `files` 为数组后返回其长度。列表映射中用该值替代硬编码的 `0`；读取或解析失败时返回 `0`，并继续返回该备份记录。

- [ ] **Step 4: 运行测试确认通过**

运行：`npm test -- --run tests/admin-api-contract.test.ts`

预期：备份 API 测试全部通过。

- [ ] **Step 5: 检查类型和相关备份行为**

运行：`npm run check`

预期：无 Astro 或 TypeScript 错误，创建、下载、验证、应用备份相关类型不受影响。

### Task 2: 为回收站搜索添加失败测试

**Files:**
- Modify: `tests/admin-client-source.test.ts` 或最接近的回收站页面源代码契约测试
- Modify: `tests/admin-client-visual.test.ts`（仅在现有测试按页面检查搜索材质时补充）
- Modify: `admin/client/src/pages/TrashPage.tsx`

- [ ] **Step 1: 写失败测试**

增加源代码或渲染契约断言：回收站页面包含 `role="search"`、`type="search"`、可访问标签和 `post-title-search` 类名；同时断言搜索逻辑会在 `item.title` 或 `item.detail` 中进行不区分大小写的包含匹配，并与类型筛选组合。

- [ ] **Step 2: 运行测试确认失败**

运行：`npm test -- --run tests/admin-client-source.test.ts tests/admin-client-visual.test.ts`

预期：新增断言因回收站尚无搜索框和查询过滤逻辑而失败。

- [ ] **Step 3: 实现最小 UI 和过滤逻辑**

在 `TrashPage.tsx` 增加 `query` state。先按类型筛选，再按 `query.trim().toLocaleLowerCase()` 对 `title` 和 `detail` 做 `includes` 匹配。将搜索表单放入现有工具条，复用文章搜索的 `search-field post-title-search` 材质，使用 `⌕` 图标、隐藏标签和“搜索回收站内容”占位符。无匹配时显示专门的空状态文案。

- [ ] **Step 4: 运行测试确认通过**

运行：`npm test -- --run tests/admin-client-source.test.ts tests/admin-client-visual.test.ts`

预期：回收站搜索相关测试通过，既有页面契约不回归。

- [ ] **Step 5: 运行完整验证**

运行：`npm test -- --run`

预期：全部 Vitest 测试通过。

### Task 3: 构建验证与工作区检查

**Files:**
- No additional source files expected.

- [ ] **Step 1: 运行生产构建**

运行：`npm run build`

预期：Astro 生产构建成功。

- [ ] **Step 2: 检查变更范围**

运行：`git status --short` 和 `git diff -- admin/server/routes/backups.ts admin/client/src/pages/TrashPage.tsx tests`

预期：仅包含本次备份计数、回收站搜索、测试及本次设计/计划文档的改动；不覆盖用户已有的其他工作区修改。

- [ ] **Step 3: 提交本次独立文档和代码变更**

仅暂存本次相关文件并提交：`git add admin/server/routes/backups.ts admin/client/src/pages/TrashPage.tsx tests docs/superpowers/specs/2026-08-27-backup-file-count-trash-search-design.md docs/superpowers/plans/2026-08-27-backup-file-count-trash-search.md; git commit -m "fix: show backup file counts and search trash"`
