# 博客与管理后台整体修复及 AI API 接入计划

> **执行要求：** 按阶段实施；功能与缺陷修复遵循测试驱动开发，完成每个阶段后运行针对性测试，最终运行完整验证。

**目标：** 修复博客与后台在数据安全、交互一致性、UI 主题、API 结构和文档方面的系统性问题，并提供受限、可审计、不可发布内容的 AI REST API。

**架构原则：** 保持 Astro 静态博客为公开发布面，Fastify/React 管理后台为唯一人工管理面；共享可复用的外观配置与对话框基础设施；浏览器会话和机器 API Token 使用不同认证路径；所有内容写入继续使用修订版本进行并发控制。

**技术栈：** Astro 7、React 19、Fastify 5、TypeScript、SQLite、Vitest、OpenAPI 3.1。

---

## 阶段 1：数据安全与会话可靠性

### 1.1 自动保存竞态

- 为自动保存增加“请求快照 + 排队快照”语义，保存响应只能确认对应快照，不能覆盖请求期间的新编辑。
- 文章和代码片段编辑器只从服务端响应合并服务端生成字段（例如 revision、规范化 slug），保留用户在途编辑。
- 增加快速连续编辑、慢响应、排队保存和冲突响应的回归测试。

### 1.2 未保存离开保护

- 当状态为 `dirty`、`saving` 或 `error` 时注册 `beforeunload`。
- 对后台内部导航提供统一异步确认；保存完成后恢复正常导航。
- 覆盖新建、编辑、保存失败和保存中的行为。

### 1.3 多标签 CSRF

- 停止在每次 `GET /api/auth/session` 时旋转 CSRF Token。
- CSRF Token 改为由服务端会话秘密确定性派生或以不会互相失效的方式返回，确保同一会话多个标签页并存。
- 客户端统一处理 401，并在 CSRF 失效时刷新会话后仅重试一次安全可重放请求。

---

## 阶段 2：前后台视觉与交互统一

### 2.1 外观配置共享

- 将主题选项、背景资源和外观常量迁移到共享模块，删除公开站点与后台的重复配置。
- 明确公开站点与后台各自允许覆盖的品牌层变量。

### 2.2 真实明暗主题

- 后台实现有效的 `system`、`light`、`dark` 三种模式。
- 为表面、文字、边框、强调色、状态色、阴影和编辑器补齐语义 Token。
- 检查 WCAG 对比度、系统减少动画设置和移动端布局。

### 2.3 对话框与 CSS 精简

- 提取统一 Dialog 基础组件，复用焦点陷阱、焦点恢复、Escape、遮罩关闭和滚动锁定。
- 将标签、封面、导入和确认对话框迁移到统一基础设施。
- 按 tokens/base/layout/components/pages 拆分后台 CSS，合并重复选择器，移除失效覆盖。

---

## 阶段 3：管理 API 清理与规范化

### 3.1 删除 Exact Preview

- 删除未使用的 exact preview 服务端路由、任务状态、快照文件生命周期和客户端方法。
- 保留无副作用的 instant preview，并更新相关测试与文档。

### 3.2 运行时校验与错误契约

- 为路由参数、查询、请求体和响应补充 Fastify JSON Schema。
- 统一错误结构：`code`、`message`、可选 `details`、`requestId`。
- 未知服务端异常不向客户端暴露内部错误消息或堆栈。

### 3.3 客户端 API 拆分

- 将单体 API 客户端拆分为 transport、auth、posts、clips、images、backups、publish 等模块。
- 保留统一凭证、CSRF、重试、错误解析和并发控制逻辑。

---

## 阶段 4：AI REST API 与 API Token

### 4.1 Token 模型与管理 UI

- 新增 `api_tokens` 表：`id`、`name`、`token_prefix`、`token_hash`、`scopes_json`、`created_at`、`expires_at`、`last_used_at`、`revoked_at`。
- Token 格式为 `aier_pat_<256-bit base64url random>`，数据库只保存哈希；明文只在创建时显示一次。
- 默认有效期 30 天，最大 365 天；后台安全设置页支持创建、查看元数据和撤销。
- 权限范围：`posts:read`、`posts:write`、`clips:read`、`clips:write`、`images:read`、`images:write`。

### 4.2 `/api/v1` 机器接口

- 文章：`GET /posts`、`GET /posts/:slug`、`POST /posts`、`PUT /posts/:slug`。
- 代码片段：`GET /clips`、`GET /clips/:slug`、`POST /clips`、`PUT /clips/:slug`。
- 图片：`GET /images`、`POST /images`。
- OpenAPI：提供受认证保护的 OpenAPI 3.1 文档端点。
- 使用 Bearer Token；更新必须提供 `If-Match`，缺失返回 428，冲突返回 409。
- AI 新建文章强制 `draft: true`、`featured: false`；更新不能修改 `draft`、`featured` 或 slug。
- 第一版禁止删除、恢复、slug 迁移、备份、日志、认证管理和发布。

### 4.3 审计与限流

- 审计记录 Token ID/名称、IP、资源、操作和修订版本，不记录 Token 明文或完整请求正文。
- 常规接口每 Token 每分钟 120 次；上传每 Token 每分钟 20 次。
- 撤销或过期 Token 立即拒绝，错误响应使用统一契约。

---

## 阶段 5：文档与完整验证

- 更新 README，准确描述 Astro 公开站点、Fastify/SQLite 后台和部署边界。
- 更新架构、后台、部署、维护和首次设置文档。
- 新增 AI API 使用文档：Token 生命周期、权限矩阵、OpenAPI、curl 示例、并发冲突、禁止发布边界。
- 清理过时 CLI 和 Exact Preview 文档。
- 运行：`npm run check`、`npm run admin:check`、`npm test -- --run`、`npm run build`、`npm run admin:build`、`npm run upgrade -- -DryRun`。

## 验收标准

- 慢速自动保存不会覆盖请求期间的新输入；未保存内容离开页面前有保护。
- 同一浏览器多个标签页不会因读取 session 而互相使 CSRF 失效。
- 后台 light/dark/system 均有真实、可访问的视觉差异，弹窗行为一致。
- 仓库不再包含 Exact Preview 的可达接口或客户端死代码。
- AI Token 只能按授权范围读写文章、代码片段和图片，无法发布或执行破坏性操作。
- OpenAPI 与实际路由 Schema 同源，所有关键行为有自动化测试。
- 完整测试、类型检查、构建和升级 DryRun 全部通过。

## 明确边界

- 当前阶段不接入 OpenAI、Anthropic 或其他模型服务；“AI 调用”仅指外部 AI 客户端调用博客 API。
- 人工后台仍是最终发布入口，AI 永远不能直接发布。
- 不改变公开博客 URL、Markdown 内容格式或现有静态发布模型。
