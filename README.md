# Aier's blogs

一个以中文内容为主的 Astro 静态博客，用于记录技术、AI、工程实践与持续构建过程中的思考。站点采用极简科技视觉、克制的毛玻璃效果、深浅主题、可选强调色和渐进增强的动效。

线上站点：`https://blog.reaier.top`

## 核心能力

- 公开站点由 Astro 7 静态生成，无数据库和运行时服务依赖；管理后台独立运行 Fastify、React 与 SQLite。
- Markdown 内容集合，构建时校验文章元数据。
- 文章列表、标签、归档、RSS、sitemap 与规范链接。
- KaTeX 数学公式和 Shiki 代码高亮。
- `callout`、`reference`、`clip` 三种自定义 Markdown 围栏。
- 独立代码剪切板页面和原始文本下载。
- 深浅主题、五种强调色、移动端适配和减少动态效果支持。
- 跨平台 Node.js + SSH 原子升级博客与后台系统，公开版本统一由管理后台发布。
- 提供使用独立 Bearer Token、Scope、revision 并发控制和 OpenAPI 3.1 的受限 AI REST API。
- Vitest 覆盖内容工具、Markdown 扩展、UI 契约、动效策略和生产构建产物。

## 技术栈

- [Astro](https://astro.build/) 7
- TypeScript 严格模式
- Markdown / Remark / Rehype
- KaTeX
- Vitest
- Node.js、SSH、Nginx（当前生产部署方案）

## 快速开始

### 环境要求

需要 **Node.js 24 LTS**、npm 和 Git。支持范围以 `package.json` 为准，依赖版本以 `package-lock.json` 为准。

```powershell
git clone https://github.com/ReAier/Blog.git
cd Blog
npm install
npm run dev
```

打开终端显示的本地地址即可预览。

### 常用命令

| 命令 | 用途 |
| --- | --- |
| `npm install` | 按 `package-lock.json` 安装依赖 |
| `npm run dev` | 启动 Astro 开发服务器 |
| `npm run check` | 运行 Astro 与 TypeScript 校验 |
| `npm test -- --run` | 单次运行全部 Vitest 测试 |
| `npm test` | 以监听模式运行测试 |
| `npm run build` | 校验并生成生产站点到 `dist/` |
| `npm run preview` | 本地预览 `dist/` 生产构建 |
| `npm run admin:build` | 构建 React 管理后台 |
| `npm run admin:server` | 启动 Fastify 管理服务 |
| `npm run admin:init -- --username owner` | 从服务器 CLI 初始化唯一管理员 |
| `npm run upgrade -- --dry-run` | 演练 SSH 系统升级流程，不上传或切换代码版本 |
| `npm run upgrade` | 升级博客代码与后台系统，不切换公开静态版本 |

升级命令会在交互式终端显示单行进度条，在 CI 或重定向日志中每个阶段只显示一行。各子命令的正常输出会被隐藏；如果失败，进度显示会先结束，然后在最后统一输出失败阶段、退出码、诊断日志尾部和完整日志路径。Windows、macOS 和 Linux 使用相同命令。

生产输出位于 `dist/`。该目录以及 `.astro/`、`.deploy/` 都是生成内容，不应直接编辑或提交。

## 内容存储策略

`src/content/` 的目录骨架由 Git 保留，但文章、代码剪切板和文章图片的内容仅保存在本机，不进入后续 Git 提交：

```text
src/content/
├── blog/.gitkeep
├── clips/.gitkeep
└── images/.gitkeep
```

实际文件分别放入 `src/content/blog/`、`src/content/clips/` 和 `src/content/images/`。`.gitignore` 会忽略这些目录中除 `.gitkeep` 外的所有文件。 Git 仅跟踪 `src/content/blog/.gitkeep`、`src/content/clips/.gitkeep` 和 `src/content/images/.gitkeep`。

从干净仓库克隆后得到的是空内容目录；要构建完整站点，需要另外准备私有内容备份并复制到 `src/content/`。停止跟踪只影响后续提交，旧 Git 历史中仍可能包含曾经提交过的文章，因此这不是敏感信息清除方案。

## 创建第一篇文章

在 `src/content/blog/` 新建 Markdown 文件，例如 `my-first-post.md`：

```markdown
---
title: '文章标题'
description: '用于列表和 SEO 的简短摘要'
publishedAt: 2026-08-11
tags:
  - Astro
draft: false
featured: false
---

正文从这里开始。
```

保存后运行：

```powershell
npm run check
npm run dev
```

完整字段、写作约定、数学公式以及自定义围栏语法见[内容创作指南](docs/content-authoring.md)。

## Markdown 扩展概览

文章除普通 Markdown 外，还支持数学公式，以及三种自定义围栏。

可折叠提示卡片：

````markdown
```callout
title: 为什么需要这样配置？

这里填写普通 Markdown 正文。
```
````

卡片默认折叠；`title` 和正文均为必填。

外部引用卡片：

````markdown
```reference
url: https://example.com/article
title: 示例文章标题
description: 可选摘要。
```
````

引用 URL 仅支持绝对的 `http` 或 `https` URL，标题与摘要由作者手动维护。

云剪切板使用 `clip` 围栏引用 `src/content/clips/` 中的大段源码，并生成独立只读页面和原始文本下载。完整字段、验证规则和数学公式示例见[内容创作指南](docs/content-authoring.md)；clip 的文件组织与安全限制见[云剪切板使用说明](docs/cloud-clipboard.md)。

## 项目结构

```text
.
├── public/                 # 原样复制的静态资源
├── scripts/                # 部署脚本
├── src/
│   ├── components/         # Astro UI 组件
│   ├── content/blog/       # 本地 Markdown 文章（Git 仅保留 .gitkeep）
│   ├── content/clips/      # 本地云剪切板源码（Git 仅保留 .gitkeep）
│   ├── layouts/            # 页面与文章布局
│   ├── lib/                # 内容、Markdown、动效等共享逻辑
│   ├── pages/              # 文件路由与静态端点
│   ├── scripts/            # 浏览器端渐进增强脚本
│   └── styles/global.css   # 全局样式、主题和响应式规则
├── tests/                  # Vitest 测试
├── astro.config.ts         # Astro、sitemap 与 Markdown 管线配置
├── src/content.config.ts   # 文章集合 schema
└── src/config.ts           # 站点名称、导航和公共元数据
```

详细模块边界和内容生成链路见[架构说明](docs/architecture.md)。

## 配置入口

- 站点名称、描述、作者、域名和导航：`src/config.ts`
- 文章 frontmatter schema：`src/content.config.ts`
- 强调色列表与默认值：`src/lib/preferences.ts`
- Astro、sitemap 和 Markdown 插件：`astro.config.ts`
- 视觉变量与组件样式：`src/styles/global.css`
- 当前服务器升级参数与流程：`scripts/upgrade.ts`

修改配置时不要在多个组件中复制相同信息；公共站点信息应继续集中在 `src/config.ts`。

## 检查与发布

提交变更前至少运行：

```powershell
npm run check
npm run build
npm test -- --run
```

当前生产环境将系统升级与公开发布分离：跨平台 Node.js + SSH 只升级博客代码和管理后台，公开静态版本由后台发布台构建并原子切换。项目也可以部署到 Nginx、Cloudflare Pages、Netlify 等普通静态托管环境。完整前置条件、演练、回滚和通用托管步骤见[部署与运维](docs/deployment.md)。

## 文档导航

| 文档 | 适用场景 |
| --- | --- |
| [架构说明](docs/architecture.md) | 理解模块边界、路由、内容生成和浏览器增强 |
| [内容创作指南](docs/content-authoring.md) | 新建文章、维护 frontmatter、使用 Markdown 扩展 |
| [部署与运维](docs/deployment.md) | 当前服务器发布、回滚和通用静态托管 |
| [管理后台部署](docs/admin-backend.md) | 单用户认证、持久内容、systemd、Nginx 与发布助手 |
| [AI REST API](docs/ai-api.md) | Token 生命周期、Scope、OpenAPI、并发更新、限流与安全边界 |
| [维护与测试指南](docs/maintenance.md) | AI 或人工修改项目、选择测试和排查故障 |
| [云剪切板使用说明](docs/cloud-clipboard.md) | 保存和引用不适合直接放入正文的大段代码 |

`docs/superpowers/` 保存历史设计与实施计划，用于了解决策背景，不作为日常操作手册。

## 维护原则

- 保持 TypeScript 严格模式和现有代码风格。
- 不直接修改或提交生成目录。
- 内容、功能、测试和文档保持同步。
- 系统升级前先执行 `npm run upgrade -- --dry-run`；公开内容只从后台发布台上线。
- 不在文章、clip、日志、文档或 Git 历史中提交凭据与敏感信息。

更完整的 AI 维护约束、变更地图和测试选择见[维护与测试指南](docs/maintenance.md)。
