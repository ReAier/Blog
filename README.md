# Aier's blogs

一个以中文内容为主的 Astro 静态博客，用于记录技术、AI、工程实践与持续构建过程中的思考。站点采用极简科技视觉、克制的毛玻璃效果、深浅主题、可选强调色和渐进增强的动效。

线上站点：`https://blog.reaier.top`

## 核心能力

- Astro 7 静态生成，无数据库和运行时服务依赖。
- Markdown 内容集合，构建时校验文章元数据。
- 文章列表、标签、归档、RSS、sitemap 与规范链接。
- KaTeX 数学公式和 Shiki 代码高亮。
- `callout`、`reference`、`clip` 三种自定义 Markdown 围栏。
- 独立代码剪切板页面和原始文本下载。
- 深浅主题、五种强调色、移动端适配和减少动态效果支持。
- PowerShell + SSH + Nginx 原子发布脚本，也可部署到普通静态托管平台。
- Vitest 覆盖内容工具、Markdown 扩展、UI 契约、动效策略和生产构建产物。

## 技术栈

- [Astro](https://astro.build/) 7
- TypeScript 严格模式
- Markdown / Remark / Rehype
- KaTeX
- Vitest
- PowerShell、SSH、Nginx（当前生产部署方案）

## 快速开始

### 环境要求

需要本机安装 Node.js、npm 和 Git。项目没有声明独立的 Node.js `engines` 约束；安装时应使用与当前 Astro 版本兼容的 Node.js 版本，并以 `package-lock.json` 为依赖版本来源。

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
| `npm run deploy -- -DryRun` | 演练当前服务器部署流程，不上传或切换版本 |
| `npm run deploy` | 执行当前生产部署流程 |

生产输出位于 `dist/`。该目录以及 `.astro/`、`.deploy/` 都是生成内容，不应直接编辑或提交。

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
│   ├── content/blog/       # Markdown 文章
│   ├── content/clips/      # 云剪切板源码
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
- 当前服务器部署参数与流程：`scripts/deploy.ps1`

修改配置时不要在多个组件中复制相同信息；公共站点信息应继续集中在 `src/config.ts`。

## 检查与发布

提交变更前至少运行：

```powershell
npm run check
npm run build
npm test -- --run
```

当前生产环境使用 PowerShell 脚本将 `dist/` 上传到 Nginx 服务器并原子切换版本。项目也可以部署到 Nginx、Cloudflare Pages、Netlify 等普通静态托管环境。完整前置条件、演练、回滚和通用托管步骤见[部署与运维](docs/deployment.md)。

## 文档导航

| 文档 | 适用场景 |
| --- | --- |
| [架构说明](docs/architecture.md) | 理解模块边界、路由、内容生成和浏览器增强 |
| [内容创作指南](docs/content-authoring.md) | 新建文章、维护 frontmatter、使用 Markdown 扩展 |
| [部署与运维](docs/deployment.md) | 当前服务器发布、回滚和通用静态托管 |
| [维护与测试指南](docs/maintenance.md) | AI 或人工修改项目、选择测试和排查故障 |
| [云剪切板使用说明](docs/cloud-clipboard.md) | 保存和引用不适合直接放入正文的大段代码 |

`docs/superpowers/` 保存历史设计与实施计划，用于了解决策背景，不作为日常操作手册。

## 维护原则

- 保持 TypeScript 严格模式和现有代码风格。
- 不直接修改或提交生成目录。
- 内容、功能、测试和文档保持同步。
- 部署前先执行 `npm run deploy -- -DryRun`。
- 不在文章、clip、日志、文档或 Git 历史中提交凭据与敏感信息。

更完整的 AI 维护约束、变更地图和测试选择见[维护与测试指南](docs/maintenance.md)。