// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { AppShell } from '../admin/client/src/components/AppShell';

vi.mock('../admin/client/src/context/AuthContext', () => ({
  useAuth: () => ({
    user: { username: 'owner', displayName: 'owner' },
    logout: vi.fn().mockResolvedValue(undefined),
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
  ['备份', '/backups', '备份页面'],
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
        { path: 'publish', element: <p>发布页面</p> },
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
