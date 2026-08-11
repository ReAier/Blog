# 维护与测试指南

本文面向项目作者、接手维护的开发者和 AI 编码代理，说明如何安全定位修改范围、选择验证命令并排查常见问题。系统结构见[架构说明](architecture.md)。

## 维护目标

每次变更应同时满足：

- 不破坏静态生成、内容可读性、SEO 和公开 URL。
- 保持没有 JavaScript 时的基础访问能力。
- 保持键盘操作、ARIA 状态和减少动态效果策略。
- 保持内容 schema、实现、测试和文档一致。
- 不将凭据、部署信息或生成产物提交到仓库。

## 私有内容边界

Git 只跟踪 `src/content/blog/.gitkeep`、`src/content/clips/.gitkeep` 和 `src/content/images/.gitkeep`。文章、clip 和文章图片属于本地数据：修改前确认备份，提交前使用 `git ls-files src/content` 检查没有实际内容被重新纳入索引。测试不得依赖固定的私人文章文件名；生产产物测试只对当前本地实际生成的文章和 clip 执行通用契约检查。
## 开始修改前

1. 阅读根目录 `AGENTS.md` 和相关专题文档。
2. 查看 `git status --short`，不要覆盖未提交的用户改动。
3. 阅读目标文件及邻近实现，不只依赖文件名猜测职责。
4. 搜索对应测试，先理解已有行为契约。
5. 明确是否会影响内容、路由、构建产物、浏览器交互或部署。
6. 对功能或修复优先补充测试；纯文档变更至少验证链接、命令和源码事实。

## 变更地图

| 需求类型 | 优先检查区域 | 最低验证 |
| --- | --- | --- |
| 新建或编辑文章 | `src/content/blog/`、内容创作指南 | `npm run check`、`npm run build` |
| 修改 frontmatter 字段 | `src/content.config.ts`、所有读取字段的页面/布局 | 内容工具测试、构建、文档更新 |
| 修改首页或文章列表 | `src/pages/`、`PostCard.astro`、`content.ts` | UI 契约、内容工具、构建产物 |
| 新增路由 | `src/pages/`、SEO、导航、`motion.ts` | `npm run check`、UI/动效测试、构建 |
| 修改 Markdown 扩展 | `astro.config.ts`、`src/lib/remark-*.ts`、CSS | 插件单元测试、UI 测试、构建产物 |
| 修改 clip | `clips.ts`、clip 页面与脚本、专题文档 | clip registry、clip UI、构建产物 |
| 修改主题或强调色 | `preferences.ts`、偏好面板、基础布局内联启动脚本、CSS | preferences、default accent、UI 测试 |
| 修改动效或导航增强 | `motion.ts`、`src/scripts/`、CSS | motion policy、motion contract、UI 测试 |
| 修改 SEO、RSS、sitemap | `SeoHead.astro`、`rss.xml.ts`、Astro 配置 | 构建产物测试和生产构建 |
| 修改部署流程 | `scripts/deploy.ps1`、`releases.ts` | deploy helpers、`-DryRun`、部署文档 |
| 修改全局样式 | `global.css`、关联组件 | UI 契约、响应式/无障碍测试、构建 |

“最低验证”不是上限。只要变更跨越多个区域，就运行这些区域验证的并集。

## 命令与职责

### `npm run check`

执行 Astro 内容同步、Astro 模板诊断和 TypeScript 校验。它擅长发现：

- 内容 schema 不匹配。
- Astro 模板类型错误。
- TypeScript 导入、参数或返回值错误。
- 部分 Markdown 构建管线错误。

它不替代 Vitest，也不证明最终 `dist/` 的 HTML 契约正确。

### `npm test -- --run`

单次执行 Vitest。测试运行在 Node 环境，主要检查：

- 纯函数与解析逻辑。
- 源文件和生成 HTML 的结构契约。
- Markdown 插件注册和输出。
- 动效、主题和无障碍策略。
- 部署版本选择逻辑。

`tests/build-output.test.ts` 会读取 `dist/`。在全新的 checkout 或删除 `dist/` 后，应先执行 `npm run build`，否则这组测试会因产物不存在而失败。

### `npm test`

启动 Vitest 监听模式，适合开发期间快速迭代。提交前仍应使用 `npm test -- --run` 获得一次完整、可复现的结果。

### `npm run build`

脚本依次执行：

```text
astro check
astro build
```

它会更新 `dist/`，并验证动态静态路径、Markdown 渲染、clip 源码和 sitemap 生成。构建成功不等于所有交互策略测试通过，因此仍需运行 Vitest。

### `npm run preview`

在本地提供生产构建，用于人工检查页面、响应式布局、主题、复制操作、目录高亮和导航切换。

### `npm run deploy -- -DryRun`

执行检查、测试、构建和打包，但不连接服务器。它验证部署脚本的本地阶段，不替代正式部署后的健康检查。

## 推荐验证顺序

### 日常源码变更

```powershell
npm run check
npm run build
npm test -- --run
```

先构建可确保生产产物测试读取的是当前代码生成的 `dist/`。

### 内容变更

```powershell
npm run check
npm run build
npm test -- --run
npm run preview
```

人工确认标题层级、目录、代码、公式、卡片、图片和链接。

### 部署相关变更

```powershell
npm run check
npm run build
npm test -- --run
npm run deploy -- -DryRun
```

正式部署只在确认目标 SSH 别名、归档路径和构建产物后执行。

## 测试体系

### 内容与工具

- `content-utils.test.ts`：阅读时间、非突变排序和标签去重。
- `preferences.test.ts`、`default-accent.test.ts`：主题解析、强调色和持久化键。
- `deploy-helpers.test.ts`：版本保留与当前版本保护。

### Markdown 扩展

- `remark-callout-card.test.ts`：callout 解析、嵌套 Markdown 与错误输入。
- `remark-reference-card.test.ts`：reference 字段、URL 安全与 HTML 转义。
- `remark-clip-card.test.ts`：clip 卡片输出。
- `callout-ui.test.ts`、`reference-ui.test.ts`、`clip-ui.test.ts`：插件注册、样式和页面集成。
- `clip-registry.test.ts`：源码扫描、草稿忽略、重复 slug、文件边界和统计。

### 浏览器交互与视觉契约

- `code-copy.test.ts`：普通代码块复制增强。
- `motion-policy.test.ts`：页面类型、帧率和增强导航策略。
- `motion-contract.test.ts`：持久背景、页面生命周期、导航、阅读进度和减少动态效果。
- `ui-contract.test.ts`：公共组件、响应式规则和无障碍结构。
- `background.test.ts`：共享背景资源和主题覆盖。

### 生产输出

`build-output.test.ts` 检查生成页面、canonical、持久动效层、Markdown 标点、KaTeX、callout、clip noindex、卡片元数据和原始文本一致性。

修改公开 HTML 契约时，应先理解该测试为何存在，再同步调整实现和期望；不要为了“让测试通过”而删除保护性断言。

## 新功能的同步要求

### 新增文章字段

必须同步考虑：

- 内容 schema。
- 文章类型或组件 Props。
- 页面、列表、RSS、SEO 是否读取该字段。
- 示例文章或测试夹具。
- README 摘要与内容创作指南。

### 新增 Markdown 围栏

必须同步考虑：

- 独立解析与 HTML 转义。
- 允许字段、重复字段、空值和错误输入。
- `astro.config.ts` 插件注册顺序。
- CSS、响应式行为和无障碍语义。
- 单元测试、UI 契约和生产构建产物测试。
- 内容创作指南中的可复制示例。

### 新增浏览器交互

必须同步考虑：

- 无 JavaScript 时的基础行为。
- Astro Client Router 导航后的重新初始化。
- 重复事件监听器和清理函数。
- 键盘与屏幕阅读器状态。
- `prefers-reduced-motion`、移动端和 hoverless 设备。
- 对应策略函数是否能抽离到 `src/lib/` 测试。

### 修改部署契约

如果改变构建命令、输出目录、正式域名、健康检查、版本目录或保留数量，必须同步更新：

- `package.json` 或 `scripts/deploy.ps1`。
- 可测试的部署辅助函数。
- 构建产物测试。
- README 与部署文档。
- 实际 Nginx 或托管平台配置。

## 常见故障排查

### 内容 schema 错误

症状：`npm run check` 报文章字段缺失或类型不匹配。

处理：定位报错文章，对照 `src/content.config.ts` 和[内容创作指南](content-authoring.md)，不要通过放宽 schema 掩盖单篇文章错误。

### 自定义围栏格式错误

症状：构建抛出 `Callout ...`、`Reference ...` 或 `Clip ...` 错误。

处理：检查围栏语言、字段拼写、重复字段、必填值和日期格式。解析器有意严格，格式错误应在构建期暴露。

### Clip slug 重复或源码缺失

症状：构建报告 `Duplicate clip slug` 或源码不存在。

处理：

- 检查不同文章是否声明了会派生出相同 slug 的文件名。
- 确认源码直接位于 `src/content/clips/` 根目录。
- 确认 `file` 没有目录或 `..`。
- 确认大小写和扩展名一致。

### 构建测试找不到 `dist/`

症状：`build-output.test.ts` 报 `ENOENT`。

处理：先运行 `npm run build`，再运行 `npm test -- --run`。这通常不是应用回归，而是生产产物尚未生成。

### 动效或无障碍契约失败

处理顺序：

1. 检查是否删除了 `data-*`、ARIA 或持久化属性。
2. 检查 Client Router 页面切换后是否重复注册监听器。
3. 检查 reduced-motion CSS 和 JS 分支。
4. 检查内容是否被 reveal 状态默认隐藏。
5. 在移动宽度和无 hover 条件下检查降级。

### 部署连接失败

先单独运行 `ssh <alias>` 和本地构建，不要直接重复正式部署。根据阶段检查 SSH 配置、网络、远端权限、磁盘空间、Nginx 配置和健康检查 Host。完整说明见[部署与运维](deployment.md)。

## AI 维护约束

AI 代理在修改本项目时应遵守：

- 先读取 `AGENTS.md`、相关文档、目标实现和测试，再制定修改方案。
- 优先使用仓库现有抽象、命名、两空格缩进、TypeScript 单引号和分号风格。
- 不编辑 `dist/`、`.astro/`、`.deploy/` 或 `node_modules/`。
- 不执行与需求无关的重构、依赖升级或格式化。
- 不覆盖用户未提交的工作。
- 不凭记忆记录平台配置；涉及 Astro、Cloudflare、Netlify 等会变化的内容时核对官方文档。
- 不把测试失败归因于“环境问题”后直接跳过；应定位根因或明确报告阻塞。
- 声称完成前运行新鲜的检查、构建和测试，并阅读退出码与失败数量。
- 不提交 `.env*`、日志、归档、服务器信息或任何凭据。
- 功能行为变化必须同步更新测试和用户可见文档。

## 提交前检查清单

- [ ] `git diff` 只包含预期文件。
- [ ] 没有修改生成目录或敏感文件。
- [ ] 新增行为有对应测试，变更行为更新了既有测试。
- [ ] README 与专题文档没有互相矛盾。
- [ ] `npm run check` 通过。
- [ ] `npm run build` 通过。
- [ ] `npm test -- --run` 通过。
- [ ] 可见 UI 变更已人工预览并准备截图。
- [ ] 部署变更已执行 `npm run deploy -- -DryRun`。
- [ ] `git diff --check` 没有空白错误。

## 相关文档

- [项目 README](../README.md)
- [架构说明](architecture.md)
- [内容创作指南](content-authoring.md)
- [部署与运维](deployment.md)
- [云剪切板使用说明](cloud-clipboard.md)