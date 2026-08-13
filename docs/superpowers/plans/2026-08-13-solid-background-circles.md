# 纯色背景圆形控件实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将设置面板中的纯色背景选项改为与强调色按钮同尺寸的圆形色块，同时保留图片背景卡片。

**Architecture:** 继续复用 `PreferencePanel.astro` 现有背景按钮及 `data-background-kind` 标记，仅通过 CSS 属性选择器区分图片和纯色样式。偏好存储、主题切换与事件逻辑不变。

**Tech Stack:** Astro 7、TypeScript、CSS、Vitest

## Global Constraints

- 纯色按钮固定为 38×38px 圆形。
- 图片按钮继续使用 4:3 缩略图。
- 浅色与深色主题继续使用各自的背景色变量。
- 保留现有无障碍属性与偏好持久化行为。

---

### Task 1: 紧凑化纯色背景选项

**Files:**
- Modify: `tests/ui-contract.test.ts`
- Modify: `src/styles/global.css`

**Interfaces:**
- Consumes: `PreferencePanel.astro` 已输出的 `data-background-kind="solid"` 与 `data-background-kind="image"`。
- Produces: 针对两类背景按钮的独立视觉契约。

- [ ] **Step 1: 写入失败的 UI 契约测试**

在背景选项测试中读取全局 CSS，并断言存在以下样式契约：

```ts
expect(css).toContain('.background-choice[data-background-kind="solid"]');
expect(css).toContain('width: 38px;');
expect(css).toContain('height: 38px;');
expect(css).toContain('border-radius: 50%;');
expect(css).toContain('.background-choice[data-background-kind="image"]');
expect(css).toContain('aspect-ratio: 4 / 3;');
```

- [ ] **Step 2: 运行单测并验证失败**

Run: `npm test -- --run tests/ui-contract.test.ts`

Expected: FAIL，因为 CSS 尚未包含按背景种类区分的选择器。

- [ ] **Step 3: 实现最小 CSS 调整**

- 将 `.background-choice-row` 改为弹性换行布局。
- 图片背景占据三列卡片宽度并保留 `aspect-ratio: 4 / 3`。
- 纯色背景设置 `width: 38px; height: 38px; border-radius: 50%`，移除比例约束，并用现有背景缩略图变量显示主题对应颜色。
- 为纯色选中态增加与强调色按钮一致的白色内圈。

- [ ] **Step 4: 运行目标测试并验证通过**

Run: `npm test -- --run tests/ui-contract.test.ts`

Expected: PASS。

- [ ] **Step 5: 完整验证**

Run: `npm test -- --run`

Run: `npm run check`

Run: `npm run build`

Expected: 所有命令退出码均为 0。
