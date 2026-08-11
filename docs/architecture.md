# 架构说明

本文面向需要理解或修改项目的维护者与 AI 代理，描述当前代码边界、静态生成过程和主要扩展点。快速运行项目请先阅读[项目 README](../README.md)。

## 架构概览

这是一个 Astro 7 静态站点。构建期间读取 Markdown 文章和代码剪切板源码，生成 HTML、RSS、sitemap 与原始代码文本；上线后不依赖数据库、Node.js 服务或后端 API。

```text
Markdown 文章 + clip 源码 + 站点配置
                │
                ▼
       Astro 内容集合与 schema
                │
                ▼
 Remark/Rehype 管线与共享内容工具
                │
                ▼
 页面路由 → 布局 → 组件 → 静态 HTML
                │
                ├── RSS / sitemap
                ├── clip 详情页与 .txt 下载
                └── 浏览器端渐进增强脚本
```

生产构建的唯一部署产物是 `dist/`。`.astro/` 是 Astro 的类型与内容缓存，`.deploy/` 存放部署归档等临时产物；三者都不属于手工维护的源码。

## 顶层配置

### `astro.config.ts`

负责：

- 设置规范站点地址 `https://blog.reaier.top`。
- 固定 `output: 'static'`。
- 注册 sitemap，并排除 `/clips/` 页面。
- 配置 Markdown 处理器。
- 按顺序注册数学公式、提示卡片、clip 卡片和外部引用卡片。
- 使用 `rehype-katex` 输出公式 HTML。

新增 Markdown 转换能力时，应同时更新此文件、对应的 `src/lib/remark-*.ts`、测试和内容创作指南。

### `src/config.ts`

保存站点标题、标记、描述、作者、语言、正式域名和主导航。页面与组件应导入 `SITE`，不要复制这些值。

### `src/content.config.ts`

定义 `blog` 内容集合，使用 `glob` 读取 `src/content/blog/**/*.md`，并通过 Zod 校验 frontmatter。字段规则见[内容创作指南](content-authoring.md)。

## 源码目录职责

### `src/components/`

组件主要分为四类：

- 站点框架：`SiteHeader`、`SiteFooter`、`SeoHead`。
- 文章展示：`PostCard`、`PostMeta`、`TableOfContents`。
- 用户偏好：`PreferencePanel`。
- 渐进增强：`MotionShell`、`CodeEnhancer`。

组件保持展示职责；跨页面的数据排序、解析、策略判断应留在 `src/lib/`。

### `src/layouts/`

- `BaseLayout.astro`：引入全局 CSS、KaTeX CSS、SEO、页头页脚、Astro Client Router、持久动效层和公共浏览器脚本。
- `PostLayout.astro`：在基础布局上增加文章标题、元信息、阅读时间、正文、目录和标签页脚。

`BaseLayout` 根据页面路径或 `article` 属性解析页面类型，动效系统据此降低文章页强度或调整其他页面表现。

### `src/pages/`

Astro 文件路由生成以下页面族：

| 路由 | 来源与职责 |
| --- | --- |
| `/` | 首页精选与最近文章 |
| `/posts/` | 全部非草稿文章 |
| `/posts/[slug]/` | 单篇文章静态页面 |
| `/tags/` | 标签汇总 |
| `/tags/[tag]/` | 指定标签文章 |
| `/archive/` | 按年份分组的时间线 |
| `/about/` | 关于页面 |
| `/clips/[slug]/` | noindex 的代码详情页 |
| `/clips/[slug].txt` | UTF-8 原始代码响应 |
| `/rss.xml` | 非草稿文章 RSS |
| `/404.html` | 静态 404 页面 |

动态路由都通过 `getStaticPaths()` 在构建期展开，不需要线上服务器执行 JavaScript。

### `src/lib/`

- `content.ts`：阅读时间、文章排序和标签汇总。
- `clips.ts`：解析 clip 元数据、扫描已发布文章、读取源码、检测重复 slug，并生成 clip 记录。
- `clip-highlight.ts`：复用 Astro Markdown 处理器为 clip 详情页生成 Shiki 高亮 HTML。
- `remark-callout-card.ts`：将 `callout` 围栏转换为可访问的 `<details>`。
- `remark-reference-card.ts`：校验 URL 和字段并输出外部引用卡片。
- `remark-clip-card.ts`：将 `clip` 围栏转换为元数据卡片。
- `motion.ts`：页面类型、动效档位、帧率门控和增强导航判断。
- `preferences.ts`：强调色定义、默认强调色和主题解析。
- `releases.ts`：部署版本清理策略的可测试实现。

这些模块是测试的主要单元边界。解析和策略逻辑不要直接埋入 Astro 模板或浏览器事件回调中。

### `src/scripts/`

浏览器脚本负责渐进增强，而不是内容可见性的前置条件：

- `fluid-background.ts`：WebGL 流体背景、性能档位和静态回退。
- `motion-controller.ts`：导航指示器、文章阅读进度、目录高亮、移动菜单、卡片指针效果和页面切换状态。
- `clip-copy.ts`：从原始 `.txt` 地址按需读取并复制 clip。
- `clip-back.ts`：clip 详情页优先返回历史页面，没有可用来源时回到文章列表。

Astro 客户端路由会替换页面内容，因此页面级脚本通常监听 `astro:page-load`，并在重新初始化前清理旧监听器。持久背景由 `window.__aierFluidCleanup` 防止重复初始化。

### `src/styles/global.css`

单一全局样式文件包含：

- 颜色、间距、字体和玻璃效果变量。
- 深浅主题与五种强调色。
- 布局、文章排版和所有组件样式。
- 持久动效层、页面微交互和响应式规则。
- `prefers-reduced-motion` 下的安全降级。

修改视觉时先复用现有变量和类命名，避免在组件内创建重复设计令牌。

## 私有内容边界

Git 只保留 `src/content/blog/`、`clips/` 和 `images/` 下的 `.gitkeep`。实际内容由本地私有备份提供，Astro 仍按原路径读取；干净克隆因此会生成不含文章和 clip 的空内容站点。应用配置 `src/content.config.ts`、解析器和页面代码继续由 Git 跟踪。
## 内容生成链路

1. Astro 使用 `src/content.config.ts` 扫描并校验 Markdown。
2. 页面查询 `blog` 集合，并在显示前过滤 `draft: true`。
3. `sortPostsNewestFirst()` 为列表、首页、RSS 等提供一致排序。
4. Markdown 处理器依次处理数学公式和三个自定义围栏。
5. `render(post)` 生成文章正文组件与标题列表。
6. `PostLayout` 根据正文源文本计算阅读时间，并将二、三级标题交给目录组件。
7. Astro 为文章、标签和 clip 生成静态路径。
8. sitemap 集成生成 sitemap，但过滤 `/clips/`；clip 页面自身输出 `noindex, nofollow`。

## Clip 注册机制

clip 不是独立内容集合。构建时，`src/lib/clips.ts` 会：

1. 递归扫描 `src/content/blog/` 中的 Markdown。
2. 跳过 frontmatter 明确包含 `draft: true` 的文章。
3. 提取顶层 `clip` 围栏。
4. 从 `file` 文件名派生小写 kebab-case slug。
5. 拒绝重复 slug、未知字段、非法日期、目录路径和不存在的源码文件。
6. 读取 `src/content/clips/` 根目录中的源码并计算 UTF-8 字节数与行数。
7. 为每个已引用 clip 生成详情页和 `.txt` 路由。

未被已发布文章声明的源码文件不会生成公开路由。更详细的作者流程见[云剪切板使用说明](cloud-clipboard.md)。

## SEO 与公开范围

`SeoHead.astro` 统一输出标题、描述、canonical、Open Graph、Twitter Card 和 RSS 发现链接。文章封面存在时会转换为正式站点绝对 URL。

公开文章同时进入列表、标签、归档、RSS 和 sitemap。clip 页面不进入 sitemap，并设置 `noindex, nofollow`，但 URL 仍然公开可访问，不能用于保存秘密。

## 主要扩展点

| 需求 | 优先检查 |
| --- | --- |
| 修改站点名称、域名或导航 | `src/config.ts`、`SeoHead.astro` |
| 增加文章字段 | `src/content.config.ts`、使用字段的页面和布局、内容测试 |
| 增加页面 | `src/pages/`、`resolvePageKind()`、SEO 与 UI 契约测试 |
| 增加 Markdown 语法 | `astro.config.ts`、`src/lib/remark-*.ts`、样式与测试 |
| 修改 clip 行为 | `clips.ts`、clip 路由、复制脚本、clip 测试与专题文档 |
| 修改主题或强调色 | `preferences.ts`、`PreferencePanel.astro`、启动内联脚本与 CSS |
| 修改动效 | `motion.ts`、浏览器脚本、CSS、减少动态效果测试 |
| 修改部署保留策略 | `deploy.ps1`、`releases.ts`、部署测试与部署文档 |

## 设计约束

- 所有核心内容在没有浏览器 JavaScript 时仍应可阅读和导航。
- `prefers-reduced-motion: reduce` 必须禁用非必要动效。
- 草稿不得进入生产页面、RSS 或 clip 注册表。
- clip 原文不得内嵌到文章卡片 HTML 中。
- 站点公共信息保持单一来源。
- 修改生产输出契约时必须更新构建产物测试和部署文档。

## 相关文档

- [项目 README](../README.md)
- [内容创作指南](content-authoring.md)
- [部署与运维](deployment.md)
- [维护与测试指南](maintenance.md)
- [云剪切板使用说明](cloud-clipboard.md)