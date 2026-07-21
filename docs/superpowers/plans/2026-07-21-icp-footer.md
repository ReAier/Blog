# ICP 备案页脚 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在博客全站页脚展示可访问、可点击的 `赣ICP备2026016483号` 工信部备案链接。

**Architecture:** 继续使用全站共用的 Astro `SiteFooter` 组件，在现有 `.footer-grid` 中增加一个独立外部链接。复用全局链接悬停、`:focus-visible` 和现有移动端纵向布局，不新增依赖或脚本。

**Tech Stack:** Astro 7、TypeScript 6、Vitest 4、CSS

## Global Constraints

- 链接文本必须精确为 `赣ICP备2026016483号`。
- 链接地址必须为 `https://beian.miit.gov.cn/`。
- 链接必须使用 `target="_blank"` 和 `rel="noopener noreferrer"`。
- 桌面端沿用 `.footer-grid` 横向布局，窄屏端沿用现有纵向布局。
- 不修改 DNS、服务器、CDN，不添加公安联网备案信息或备案主体名称。
- 不添加新依赖，不重构页脚。

---

### Task 1: 增加并验证 ICP 备案链接

**Files:**
- Modify: `tests/ui-contract.test.ts`
- Modify: `src/components/SiteFooter.astro:4-9`

**Interfaces:**
- Consumes: `BaseLayout.astro` 已有的 `<SiteFooter />` 全站挂载方式、`global.css` 已有的通用 `a:hover`、`:focus-visible` 和窄屏 `.footer-grid` 规则。
- Produces: 一个文本为 `赣ICP备2026016483号`、指向 `https://beian.miit.gov.cn/` 的安全外部链接。

- [ ] **Step 1: 写入失败的页脚契约测试**

在 `tests/ui-contract.test.ts` 的 `visual shell contract` 测试组中加入：

```ts
  it('provides the approved ICP registration link in the global footer', async () => {
    const footer = await read('src/components/SiteFooter.astro');
    expect(footer).toContain('赣ICP备2026016483号');
    expect(footer).toContain('href="https://beian.miit.gov.cn/"');
    expect(footer).toContain('target="_blank"');
    expect(footer).toContain('rel="noopener noreferrer"');
  });
```

- [ ] **Step 2: 运行单项测试并确认失败**

Run: `npm test -- --run tests/ui-contract.test.ts`

Expected: FAIL；新测试报告页脚中缺少 `赣ICP备2026016483号`。

- [ ] **Step 3: 在全站页脚加入最小实现**

将 `src/components/SiteFooter.astro` 更新为：

```astro
---
import { SITE } from '../config';
---
<footer class="site-footer">
  <div class="container footer-grid">
    <span>© {new Date().getFullYear()} {SITE.author}</span>
    <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer">赣ICP备2026016483号</a>
    <span>Built with Astro · Keep building.</span>
  </div>
</footer>
```

不新增 CSS：现有全局 `a:hover` 和 `:focus-visible` 已覆盖交互状态；现有移动端 `.footer-grid` 纵向规则已覆盖窄屏布局。

- [ ] **Step 4: 运行单项测试并确认通过**

Run: `npm test -- --run tests/ui-contract.test.ts`

Expected: PASS；`visual shell contract` 中所有测试通过。

- [ ] **Step 5: 运行完整验证**

Run: `npm test -- --run`

Expected: PASS；全部 Vitest 测试通过。

Run: `npm run build`

Expected: PASS；`astro check` 无错误，生产构建成功，并生成 `dist` 静态站点。

Run: `Select-String -Path dist/index.html -Pattern '赣ICP备2026016483号|https://beian.miit.gov.cn/'`

Expected: 输出同时包含备案号和工信部链接，证明首页静态产物已包含该页脚。

- [ ] **Step 6: 提交实现**

```bash
git add tests/ui-contract.test.ts src/components/SiteFooter.astro
git commit -m "feat: add ICP registration to footer"
```
