# Aier's blogs

中文为主的 Astro 静态博客，使用极简科技视觉、克制毛玻璃、深浅模式和可选强调色。

## 本地运行

```powershell
npm install
npm run dev
```

打开终端显示的本地地址即可预览。

## 创建文章

在 `src/content/blog/` 新建 Markdown 文件：

```markdown
---
title: "文章标题"
description: "用于列表和 SEO 的简短摘要"
publishedAt: 2026-07-11
updatedAt: 2026-07-12
tags:
  - AI
  - 工程实践
draft: false
featured: false
---

正文从这里开始。
```

字段说明：

- `title`：必填标题。
- `description`：必填摘要。
- `publishedAt`：首次发布日期。
- `updatedAt`：可选更新日期。
- `tags`：标签数组。
- `draft`：设为 `true` 时不进入生产站点。
- `featured`：设为 `true` 时可出现在首页精选区域。
- `cover`：可选社交分享图片路径。

## 云剪切板

较长代码可以保存到独立的只读代码页，再通过 Markdown 围栏卡片放入文章正文。保存源码、填写围栏元数据和引用卡片的完整步骤见：

```text
docs/cloud-clipboard.md
```

## 外部引用卡片

需要推荐或引用外部网页时，可以直接在文章 Markdown 中填写一个 `reference` 围栏：

````markdown
```reference
url: https://example.com/article
title: 示例文章标题
description: 这是一段可选的文章简介。
```
````

`url` 和 `title` 必填，`description` 可选；每个字段独占一行。URL 仅支持绝对的 `http` 或 `https` URL。标题和摘要由作者手动维护，构建过程不会访问目标网站。重复字段、未知字段或格式错误会使检查和构建失败。

## 检查与构建

```powershell
npm run check
npm test -- --run
npm run build
```

静态文件生成在 `dist/`。

## 修改站点信息

站名、描述、导航和可选强调色集中在：

```text
src/config.ts
src/lib/preferences.ts
```

全局视觉变量位于：

```text
src/styles/global.css
```

## 部署

前置条件：

- 本机 SSH 别名 `aliyun-aiopt` 可正常连接服务器。
- 服务器已创建 `/var/www/aier-blog/releases`。
- Nginx 已配置 `blog.reaier.top`，root 指向 `/var/www/aier-blog/current`。

先执行演练：

```powershell
npm run deploy -- -DryRun
```

正式部署：

```powershell
npm run deploy
```

脚本会依次执行类型检查、测试、生产构建、压缩上传、原子切换、Nginx 验证和站点健康检查，并保留最近 5 个版本。

## 回滚

登录服务器：

```powershell
ssh aliyun-aiopt
```

查看版本：

```bash
ls -1dt /var/www/aier-blog/releases/*
readlink -f /var/www/aier-blog/current
```

切换到指定版本：

```bash
ln -sfn /var/www/aier-blog/releases/版本目录 /var/www/aier-blog/current
nginx -t && systemctl reload nginx
```
