# Callout Math Rendering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复折叠 `callout` 卡片内部公式无法渲染的问题。

**Architecture:** 保持现有卡片转换结构，仅在 `fromMarkdown` 的嵌套解析中加入数学语法扩展；现有 `rehype-katex` 继续负责最终 HTML 渲染。

**Tech Stack:** Astro 7, unified, mdast-util-from-markdown, remark-math, rehype-katex, Vitest.

## Global Constraints

- 使用 TypeScript，保持现有两空格缩进、单引号、分号和尾逗号风格。
- 不修改生成目录 `dist/`、`.astro/`、`.deploy/`。
- Bug 修复必须有先失败后通过的回归测试。

---

### Task 1: Add failing regression coverage

**Files:**
- Modify: `tests/remark-callout-card.test.ts`

- [ ] Add a test using `remarkMath` and `rehypeKatex` that asserts inline math inside a callout becomes KaTeX markup.
- [ ] Add a test for display math inside a callout.
- [ ] Run the focused test and confirm it fails because nested `fromMarkdown` does not recognize math.

### Task 2: Enable math in nested callout parsing

**Files:**
- Modify: `src/lib/remark-callout-card.ts`

- [ ] Import the math micromark and mdast extensions.
- [ ] Pass both extensions to `fromMarkdown(definition.body, { extensions, mdastExtensions })`.
- [ ] Run focused tests and confirm they pass.

### Task 3: Verify the repository

- [ ] Run `npm test -- --run`.
- [ ] Run `npm run check`.
- [ ] Run `npm run build`.
- [ ] Review the diff for unintended generated-file changes.
