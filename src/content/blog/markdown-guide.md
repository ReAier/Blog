---
title: "Markdown 写作示例"
description: "展示标题、列表、引用、代码、云剪切板、提示卡片与表格在博客中的排版效果。"
publishedAt: 2026-07-10
updatedAt: 2026-08-03
tags:
  - Markdown
  - 写作
draft: false
featured: false
---

Markdown 让写作者把注意力放在内容本身，而不是复杂的排版工具上。

## 代码块

```ts
const site = {
  name: "Aier's blogs",
  principle: 'Keep building.',
};

console.log(site.name);
```

## 云剪切板

较长代码可以放在独立的剪切板页面中，正文只展示紧凑的引用卡片。

```clip
title: Astro 配置示例
description: 云剪切板的内置示例，用于验证代码详情页、复制与下载功能。
language: typescript
file: astro.config.ts
createdAt: 2026-08-03
```

## 可折叠提示卡片

补充说明可以放进默认折叠的 Callout 中，读者需要时再展开查看。

```callout
title: 为什么使用原生折叠元素？

原生折叠元素无需额外脚本，并且支持键盘操作。正文仍然可以使用 **Markdown**：

- 添加多段说明
- 插入[相关链接](https://docs.astro.build/zh-cn/guides/markdown-content/)
- 展示 `行内代码`
```

## 外部引用卡片

外部资料可以写成紧凑的引用卡片，标题和简介直接保存在 Markdown 中。点击“访问原文”会在新标签页打开目标网页。

```reference
url: https://docs.astro.build/zh-cn/guides/markdown-content/
title: Astro：Markdown 与 MDX
description: Astro 官方的 Markdown 内容与配置指南。
```

引用站内文章时使用文章的完整线上地址：

```reference
url: https://blog.reaier.top/posts/welcome/
title: 欢迎来到 Aier's blogs
description: 这是博客的第一篇文章，也是一次持续记录的开始。
```

## 引用

> 好的工具不会抢走注意力，而是让想法更自然地抵达读者。

## 列表

1. 写下想法。
2. 在本机预览。
3. 提交到 Git。
4. 一条命令部署。

## 表格

| 能力 | 实现方式 |
|---|---|
| 内容 | Markdown |
| 构建 | Astro |
| 服务 | Nginx |
| 发布 | SSH 原子部署 |

这篇文章也会作为新样式的长期回归测试页面。

## 数学公式

令 $S_n = \sum_{i=1}^n a_i$

$$
\int_0^1 x^2 dx
$$
