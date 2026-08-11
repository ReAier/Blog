# 内容创作指南

本文说明如何新建、预览和发布博客文章，以及如何使用项目提供的 Markdown 扩展。项目安装与命令入口见[项目 README](../README.md)。

## 文章位置与 URL

文章保存在：

```text
src/content/blog/
```

文件可以位于子目录中，但应使用清晰、稳定的小写文件名，优先采用 kebab-case：

```text
src/content/blog/astro-content-guide.md
```

Astro 使用文章条目的 `id` 生成 `/posts/<id>/`。发布后重命名或移动文件会改变 URL；项目目前没有自动重定向机制，因此应谨慎修改已发布文章路径。

## 最小文章模板

```markdown
---
title: '文章标题'
description: '用于列表、RSS 和 SEO 的简短摘要'
publishedAt: 2026-08-11
tags:
  - Astro
draft: false
featured: false
---

正文从这里开始。
```

日期建议使用无时区歧义的 `YYYY-MM-DD` 格式。

## Frontmatter 字段

字段由 `src/content.config.ts` 校验。

| 字段 | 类型 | 必填 | 默认值 | 用途 |
| --- | --- | --- | --- | --- |
| `title` | 非空字符串 | 是 | 无 | 页面标题、文章列表和 RSS 标题 |
| `description` | 非空字符串 | 是 | 无 | 列表摘要、SEO 和 RSS 描述 |
| `publishedAt` | 可转换为日期的值 | 是 | 无 | 排序、页面元信息和归档 |
| `updatedAt` | 可转换为日期的值 | 否 | 无 | 显示最近更新时间 |
| `tags` | 非空字符串数组 | 否 | `[]` | 标签页、文章元信息和 RSS 分类 |
| `draft` | 布尔值 | 否 | `false` | 为 `true` 时排除生产文章与 clip 注册 |
| `featured` | 布尔值 | 否 | `false` | 允许文章进入首页精选区域 |
| `cover` | 字符串 | 否 | 无 | Open Graph/Twitter 分享图片路径或 URL |

维护约定：

- `updatedAt` 只在文章发生有意义的内容更新时添加或修改。
- 标签大小写会在统计时视为相同标签，并保留首次出现的显示形式。
- `featured: true` 不保证无限展示；首页会按发布日期排序后截取有限数量。
- `cover` 应指向可被正式站点访问的图片，站点会基于正式域名生成绝对地址。
- 草稿仍会接受内容 schema 校验，但不会生成文章页、RSS 项或 clip 页面。

## 普通 Markdown

项目支持标题、段落、引用、列表、表格、链接、图片、强调、行内代码和代码块等常见语法。

````markdown
## 二级标题

一段包含 **重点**、`inline code` 和[链接](https://example.com)的文字。

> 这是一段引用。

```typescript
const greeting = 'hello';
console.log(greeting);
```
````

文章目录只收集二级和三级标题。标题文字应简短明确，并避免手工重复设置相同锚点。

普通代码块由 Shiki 高亮，浏览器脚本会为正文中的 `<pre>` 增加“复制代码”按钮。复制功能失败时，代码内容仍然可手工选择。

## 数学公式

行内公式使用单个美元符号：

```markdown
欧拉恒等式为 $e^{i\pi}+1=0$。
```

块级公式使用双美元符号：

```markdown
$$
\int_0^1 x^2\,dx = \frac{1}{3}
$$
```

构建时由 `remark-math` 和 `rehype-katex` 转换，基础布局统一加载 KaTeX 样式。

## 可折叠提示卡片

需要补充解释但不希望打断正文时，使用 `callout` 围栏：

````markdown
```callout
title: 为什么需要这样配置？

这里可以继续使用普通 **Markdown**：

- 多段文字
- 列表和链接
- 行内代码
```
````

规则：

- 第一行必须是 `title: 标题`。
- 标题必须非空。
- 标题之后必须存在非空正文。
- 正文会再次按 Markdown 解析，可以包含段落、列表、链接和代码块。
- 卡片输出为原生 `<details>`，默认折叠且支持键盘操作。

缺少标题、标题不在第一行或正文为空会使检查或构建失败。

## 外部引用卡片

引用外部网页时使用 `reference` 围栏：

````markdown
```reference
url: https://example.com/article
title: 示例文章标题
description: 一段由作者维护的可选摘要。
```
````

规则：

- `url` 和 `title` 必填，`description` 可选。
- 每个非空行必须使用 `key: value` 格式。
- 只允许 `url`、`title`、`description` 三个字段。
- 字段不可重复，字段值不可为空。
- URL 必须是绝对的 `http` 或 `https` 地址。
- 标题和摘要由作者手动维护；构建过程不会访问目标网站抓取元数据。
- 输出链接会在新标签页打开，并带有 `noopener noreferrer`。

未知字段、重复字段、相对 URL 或其他协议会使构建失败。

## 云剪切板引用

较长代码应保存为独立源码文件，再通过 `clip` 围栏引用：

````markdown
```clip
title: OAuth 回调处理
description: 处理授权码交换和登录状态写入。
language: typescript
file: oauth-callback.ts
createdAt: 2026-08-11
updatedAt: 2026-08-11
```
````

正文只生成元数据卡片，不嵌入全部源码。构建会为该声明生成：

```text
/clips/oauth-callback/
/clips/oauth-callback.txt
```

源码保存、slug 派生、日期约束、重复检测、安全边界和更新流程见[云剪切板使用说明](cloud-clipboard.md)。不要把密码、API Key、Token、私钥、Cookie 或隐私数据放入 clip。

## 图片与静态资源

不需要构建处理的静态文件放入 `public/`，并使用以 `/` 开头的站点路径引用：

```markdown
![示例图片](/images/example.webp)
```

文章封面同样可以使用 `public/` 下的路径：

```yaml
cover: /images/example-cover.webp
```

提交前确认文件名大小写与引用完全一致。Linux 静态服务器通常区分大小写。

## 草稿与预览

草稿示例：

```yaml
draft: true
```

当前页面查询会过滤草稿，因此草稿不会出现在站点页面中。若需要预览，可在本地临时设为 `false`，完成预览后恢复为 `true`；提交前检查该字段状态。

运行开发服务器：

```powershell
npm run dev
```

运行内容和类型校验：

```powershell
npm run check
```

## 常见构建错误

### Frontmatter 校验失败

检查：

- `title`、`description`、`publishedAt` 是否存在。
- 日期是否可解析。
- `tags` 是否为字符串数组。
- `draft`、`featured` 是否为布尔值。
- 是否使用了 schema 未声明的错误结构。

### Callout 解析失败

确认 `title:` 位于围栏第一行，并且标题与正文都非空。

### Reference 解析失败

确认字段名称准确、没有重复字段，并且 URL 以 `http://` 或 `https://` 开头。

### Clip 解析失败

确认元数据字段、日期、源码文件和派生 slug 均满足[云剪切板使用说明](cloud-clipboard.md)中的要求。

## 发布前检查清单

- [ ] 文件名与预期文章 URL 稳定且清晰。
- [ ] 标题、摘要、发布日期和标签正确。
- [ ] 草稿与精选状态符合预期。
- [ ] 更新文章时按需维护 `updatedAt`。
- [ ] 图片与链接可访问，不包含本机路径。
- [ ] 自定义围栏字段完整且无敏感信息。
- [ ] 运行 `npm run check`。
- [ ] 运行 `npm test -- --run`。
- [ ] 运行 `npm run build`。
- [ ] 必要时运行 `npm run preview` 检查生产页面。

## 相关文档

- [项目 README](../README.md)
- [架构说明](architecture.md)
- [部署与运维](deployment.md)
- [维护与测试指南](maintenance.md)
- [云剪切板使用说明](cloud-clipboard.md)