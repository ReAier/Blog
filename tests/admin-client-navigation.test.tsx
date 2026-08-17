// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { AppShell } from '../admin/client/src/components/AppShell';

const { logout } = vi.hoisted(() => ({ logout: vi.fn().mockResolvedValue(undefined) }));

vi.mock('../admin/client/src/context/AuthContext', () => ({
  useAuth: () => ({
    user: { username: 'owner', displayName: 'owner' },
    logout,
  }),
}));

afterEach(() => cleanup());

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockImplementation(() => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
});

const destinations = [
  ['工作台', '/', '工作台页面'],
  ['文章', '/posts', '文章页面'],
  ['剪切板', '/clips', 'Clips 页面'],
  ['图片库', '/images', '图片库页面'],
  ['发布与日志', '/publish', '发布页面'],
] as const;

function testRouter() {
  return createMemoryRouter([
    {
      path: '/',
      element: <AppShell />,
      children: [
        { index: true, element: <p>工作台页面</p> },
        { path: 'posts', element: <p>文章页面</p> },
        { path: 'posts/:slug', element: <p>文章编辑页面</p> },
        { path: 'clips', element: <p>Clips 页面</p> },
        { path: 'images', element: <p>图片库页面</p> },
        { path: 'backups', element: <p>备份页面</p> },
        { path: 'security', element: <p>API 与安全页面</p> },
        { path: 'trash', element: <p>回收站页面</p> },
        { path: 'publish', element: <p>发布页面</p> },
        { path: 'login', element: <p>登录页面</p> },
      ],
    },
  ], { initialEntries: ['/posts/current-article'] });
}

describe('admin navigation from an open article', () => {
  it.each(destinations)('opens %s through the persistent header', async (label, path, content) => {
    const router = testRouter();
    render(<RouterProvider router={router} />);

    expect(screen.getByText('文章编辑页面')).toBeInTheDocument();
    const navigation = screen.getByRole('navigation', { name: '主导航' });
    fireEvent.click(within(navigation).getByRole('link', { name: label }));

    await waitFor(() => expect(router.state.location.pathname).toBe(path));
    expect(screen.getByText(content)).toBeInTheDocument();
  });
});


describe('admin settings menu', () => {
  it('moves low-frequency destinations and logout into the settings menu', async () => {
    const router = testRouter();
    render(<RouterProvider router={router} />);

    const primaryNavigation = screen.getByRole('navigation', { name: '主导航' });
    expect(within(primaryNavigation).queryByRole('link', { name: '备份' })).not.toBeInTheDocument();
    expect(within(primaryNavigation).queryByRole('link', { name: 'API 与安全' })).not.toBeInTheDocument();
    expect(screen.queryByText('责任编辑')).not.toBeInTheDocument();
    expect(screen.queryByText('owner')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '退出' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '设置' }));
    const settings = screen.getByRole('navigation', { name: '设置菜单' });
    expect(within(settings).getByRole('link', { name: '回收站' })).toHaveAttribute('href', '/trash');
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
    logout.mockClear();
    const router = testRouter();
    render(<RouterProvider router={router} />);
    fireEvent.click(screen.getByRole('button', { name: '设置' }));
    fireEvent.click(screen.getByRole('button', { name: '退出登录' }));

    await waitFor(() => expect(logout).toHaveBeenCalledTimes(1));
    expect(router.state.location.pathname).toBe('/login');
  });
});
