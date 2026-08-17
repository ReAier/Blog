# 后台设置菜单 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将单用户博客后台右上角账户区替换为设置按钮，并把备份、API 与安全、退出登录收纳进可访问的下拉菜单。

**Architecture:** 继续由 `AppShell` 管理全局导航和退出流程，新增独立的设置菜单开关状态、容器引用以及键盘/外部点击关闭逻辑。现有 `/backups` 与 `/security` 路由和页面保持不变，只改变入口位置；样式继续使用后台已有主题变量。

**Tech Stack:** React 19、React Router 7、TypeScript、CSS、Vitest、Testing Library。

## Global Constraints

- 单用户后台不显示用户名、角色文案或首字母头像。
- 主导航不再显示“备份”和“API 与安全”。
- 设置菜单顺序固定为“备份”“API 与安全”、分隔线、“退出登录”。
- 菜单必须支持按钮切换、路由变化、点击外部和 Escape 关闭。
- 不新增依赖，不修改现有备份/API 页面路由和退出 API。

---

### Task 1: 设置菜单行为与导航契约

**Files:**
- Modify: `tests/admin-client-navigation.test.tsx`
- Modify: `tests/admin-client-shell.test.ts`
- Modify: `admin/client/src/components/AppShell.tsx`

**Interfaces:**
- Consumes: `useAuth().logout(): Promise<void>`、React Router 的 `NavLink`、`useLocation()`、`useNavigate()`。
- Produces: `AppShell` 中 `aria-label="设置"` 的触发按钮和 `aria-label="设置菜单"` 的导航菜单；菜单链接仍指向 `/backups` 和 `/security`。

- [ ] **Step 1: 写失败的交互测试**

在 `tests/admin-client-navigation.test.tsx` 中把 mock 的退出函数提取为可断言变量，并新增设置菜单测试。核心测试代码如下：

```tsx
const logout = vi.fn().mockResolvedValue(undefined);

vi.mock('../admin/client/src/context/AuthContext', () => ({
  useAuth: () => ({ logout }),
}));

it('moves low-frequency destinations and logout into the settings menu', async () => {
  const router = testRouter();
  render(<RouterProvider router={router} />);

  const primaryNavigation = screen.getByRole('navigation', { name: '主导航' });
  expect(within(primaryNavigation).queryByRole('link', { name: '备份' })).not.toBeInTheDocument();
  expect(within(primaryNavigation).queryByRole('link', { name: 'API 与安全' })).not.toBeInTheDocument();
  expect(screen.queryByText('责任编辑')).not.toBeInTheDocument();
  expect(screen.queryByText('owner')).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: '设置' }));
  const settings = screen.getByRole('navigation', { name: '设置菜单' });
  expect(within(settings).getByRole('link', { name: '备份' })).toHaveAttribute('href', '/backups');
  expect(within(settings).getByRole('link', { name: 'API 与安全' })).toHaveAttribute('href', '/security');
  expect(within(settings).getByRole('button', { name: '退出登录' })).toBeInTheDocument();
});

it('closes the settings menu with Escape and outside clicks', () => {
  render(<RouterProvider router={testRouter()} />);
  const trigger = screen.getByRole('button', { name: '设置' });

  fireEvent.click(trigger);
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(screen.queryByRole('navigation', { name: '设置菜单' })).not.toBeInTheDocument();

  fireEvent.click(trigger);
  fireEvent.pointerDown(document.body);
  expect(screen.queryByRole('navigation', { name: '设置菜单' })).not.toBeInTheDocument();
});

it('logs out from the settings menu and returns to login', async () => {
  const router = testRouter();
  render(<RouterProvider router={router} />);
  fireEvent.click(screen.getByRole('button', { name: '设置' }));
  fireEvent.click(screen.getByRole('button', { name: '退出登录' }));

  await waitFor(() => expect(logout).toHaveBeenCalledTimes(1));
  expect(router.state.location.pathname).toBe('/login');
});
```

同时给 `testRouter()` 增加 `/security` 和 `/login` 测试路由，并从 `destinations` 删除备份入口。

- [ ] **Step 2: 运行测试并确认按预期失败**

运行：

```powershell
npm test -- --run tests/admin-client-navigation.test.tsx
```

预期：测试因找不到“设置”按钮，且主导航仍存在“备份”和“API 与安全”而失败。

- [ ] **Step 3: 实现最小设置菜单逻辑**

在 `admin/client/src/components/AppShell.tsx`：

1. 从 `navigation` 删除 `/backups` 与 `/security`。
2. 删除 `user` 解构、`.account-copy`、`.avatar` 和独立退出按钮。
3. 新增：

```tsx
const [settingsOpen, setSettingsOpen] = useState(false);
const settingsRef = useRef<HTMLDivElement>(null);
```

4. 扩展路由变化 effect：

```tsx
useEffect(() => {
  setMenuOpen(false);
  setSettingsOpen(false);
}, [location.pathname]);
```

5. 新增 Escape 与外部指针关闭 effect：

```tsx
useEffect(() => {
  if (!settingsOpen) return;
  const closeOnEscape = (event: KeyboardEvent) => {
    if (event.key === 'Escape') setSettingsOpen(false);
  };
  const closeOnOutsidePointer = (event: PointerEvent) => {
    if (!settingsRef.current?.contains(event.target as Node)) setSettingsOpen(false);
  };
  window.addEventListener('keydown', closeOnEscape);
  document.addEventListener('pointerdown', closeOnOutsidePointer);
  return () => {
    window.removeEventListener('keydown', closeOnEscape);
    document.removeEventListener('pointerdown', closeOnOutsidePointer);
  };
}, [settingsOpen]);
```

6. 在 `.admin-utilities` 中渲染设置按钮和条件菜单。齿轮使用内联 SVG，避免新增图标依赖：

```tsx
<div className="settings-control" ref={settingsRef}>
  <button
    className="settings-trigger"
    type="button"
    aria-label="设置"
    aria-expanded={settingsOpen}
    aria-controls="admin-settings-menu"
    onClick={() => setSettingsOpen((value) => !value)}
  >
    <svg aria-hidden="true" viewBox="0 0 24 24">...</svg>
    <span>设置</span>
  </button>
  {settingsOpen && (
    <nav id="admin-settings-menu" className="settings-menu" aria-label="设置菜单">
      <NavLink to="/backups" className={({ isActive }) => `settings-menu-item${isActive ? ' is-active' : ''}`}>备份</NavLink>
      <NavLink to="/security" className={({ isActive }) => `settings-menu-item${isActive ? ' is-active' : ''}`}>API 与安全</NavLink>
      <div className="settings-menu-divider" aria-hidden="true" />
      <button className="settings-menu-item settings-menu-logout" type="button" onClick={handleLogout}>退出登录</button>
    </nav>
  )}
</div>
```

- [ ] **Step 4: 更新源代码契约测试**

在 `tests/admin-client-shell.test.ts` 中断言：

```ts
expect(shell).not.toContain("{ to: '/backups', label: '备份' }");
expect(shell).not.toContain("{ to: '/security', label: 'API 与安全'");
expect(shell).not.toContain('责任编辑');
expect(shell).not.toContain('className="avatar"');
expect(shell).toContain('aria-label="设置"');
expect(shell).toContain('aria-label="设置菜单"');
expect(shell).toContain('>备份</NavLink>');
expect(shell).toContain('>API 与安全</NavLink>');
expect(shell).toContain('>退出登录</button>');
```

- [ ] **Step 5: 运行目标测试并确认通过**

运行：

```powershell
npm test -- --run tests/admin-client-navigation.test.tsx tests/admin-client-shell.test.ts
```

预期：两个测试文件全部通过。

- [ ] **Step 6: 提交行为改动**

```powershell
git add tests/admin-client-navigation.test.tsx tests/admin-client-shell.test.ts admin/client/src/components/AppShell.tsx
git commit -m "feat: move admin utilities into settings menu"
```

### Task 2: 设置菜单视觉与响应式样式

**Files:**
- Modify: `admin/client/src/styles.css`
- Modify: `tests/admin-client-visual.test.ts`

**Interfaces:**
- Consumes: Task 1 生成的 `.settings-control`、`.settings-trigger`、`.settings-menu`、`.settings-menu-item`、`.settings-menu-divider`、`.settings-menu-logout`。
- Produces: 与现有后台主题一致的桌面/移动设置菜单样式。

- [ ] **Step 1: 写失败的视觉契约测试**

在 `tests/admin-client-visual.test.ts` 中新增：

```ts
it('styles the compact settings trigger and anchored menu', async () => {
  const styles = await read('styles.css');

  expect(styles).toContain('.settings-control { position: relative; }');
  expect(styles).toContain('.settings-trigger');
  expect(styles).toContain('.settings-menu {');
  expect(styles).toContain('position: absolute;');
  expect(styles).toContain('right: 0;');
  expect(styles).toContain('.settings-menu-item.is-active');
  expect(styles).toContain('.settings-menu-divider');
});
```

- [ ] **Step 2: 运行测试并确认按预期失败**

运行：

```powershell
npm test -- --run tests/admin-client-visual.test.ts
```

预期：缺少 `.settings-*` 样式断言而失败。

- [ ] **Step 3: 添加菜单样式**

在 `admin/client/src/styles.css` 的顶部导航样式区添加：

```css
.settings-control { position: relative; }
.settings-trigger {
  min-height: 40px;
  padding: 0 12px;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: var(--text);
  background: var(--subtle-fill);
  border: 1px solid var(--line);
  border-radius: 11px;
  font: .68rem var(--sans);
}
.settings-trigger svg { width: 17px; height: 17px; fill: none; stroke: currentColor; stroke-width: 1.8; }
.settings-menu {
  position: absolute;
  top: calc(100% + 10px);
  right: 0;
  z-index: 20;
  width: min(220px, calc(100vw - 24px));
  padding: 7px;
  display: grid;
  gap: 3px;
  background: var(--dialog-surface);
  border: 1px solid var(--line);
  border-radius: 14px;
  box-shadow: 0 20px 54px rgba(0, 0, 0, .42);
  backdrop-filter: blur(22px);
}
.settings-menu-item {
  min-height: 42px;
  padding: 0 11px;
  display: flex;
  align-items: center;
  color: var(--text-soft);
  background: transparent;
  border: 0;
  border-radius: 9px;
  font: .72rem var(--sans);
  text-decoration: none;
  text-align: left;
}
.settings-menu-item:hover,
.settings-menu-item:focus-visible,
.settings-menu-item.is-active { color: var(--text); background: var(--subtle-fill); }
.settings-menu-divider { height: 1px; margin: 4px 5px; background: var(--line); }
.settings-menu-logout { width: 100%; color: var(--danger, var(--coral)); cursor: pointer; }
```

删除仅服务于旧账户区的 `.account-menu`、`.account-copy`、`.avatar` 和移动端隐藏退出/头像规则；保留仍被其他页面使用的通用 `.text-button`。

- [ ] **Step 4: 运行视觉与交互测试**

运行：

```powershell
npm test -- --run tests/admin-client-visual.test.ts tests/admin-client-navigation.test.tsx tests/admin-client-shell.test.ts
```

预期：三个测试文件全部通过。

- [ ] **Step 5: 运行类型、完整测试与构建验证**

运行：

```powershell
npm run admin:check
npm test -- --run
npm run build
npm run admin:build
```

预期：所有命令退出码为 0，无 TypeScript、Vitest、Astro 或 Vite 构建错误。

- [ ] **Step 6: 提交样式改动**

```powershell
git add admin/client/src/styles.css tests/admin-client-visual.test.ts
git commit -m "style: add compact admin settings menu"
```
