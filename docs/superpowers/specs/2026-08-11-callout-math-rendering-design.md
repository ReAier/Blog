# Callout Math Rendering Design

## Goal

让可折叠 `callout` 卡片内部的行内公式和块级公式经过与正文一致的 Markdown 数学语法解析，并由现有 KaTeX 流程渲染。

## Chosen approach

在 `src/lib/remark-callout-card.ts` 的嵌套 Markdown 解析中显式传入 `remark-math` 对应的 micromark 与 mdast 扩展。这样只补齐嵌套解析缺失的语法能力，不改变卡片 HTML 结构，也不重复运行完整 unified 流程。

## Verification

在 `tests/remark-callout-card.test.ts` 增加行内与块级公式回归测试；运行 Vitest、Astro check 和 production build。
