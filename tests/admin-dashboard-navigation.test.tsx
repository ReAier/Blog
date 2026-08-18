// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { DashboardPage } from '../admin/client/src/pages/DashboardPage';

const { dashboard } = vi.hoisted(() => ({
  dashboard: vi.fn(),
}));

vi.mock('../admin/client/src/api/client', () => ({
  api: { dashboard },
}));

beforeEach(() => {
  dashboard.mockResolvedValue({
    counts: { posts: 4, drafts: 1, clips: 11, images: 3 },
    recentPosts: [],
    clipStorageBytes: 643686,
    imageStorageBytes: 1280,
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('dashboard statistic navigation', () => {
  it('links every statistic card to its matching workspace page', async () => {
    render(<MemoryRouter><DashboardPage /></MemoryRouter>);

    await waitFor(() => expect(dashboard).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('link', { name: /全部文章/ })).toHaveAttribute('href', '/posts');
    expect(screen.getByRole('link', { name: /剪切板/ })).toHaveAttribute('href', '/clips');
    expect(screen.getByRole('link', { name: /图片资产/ })).toHaveAttribute('href', '/images');
    expect(screen.getByRole('link', { name: /最近发布/ })).toHaveAttribute('href', '/publish');
  });

  it('shows resource-specific formatted sizes for clips and images', async () => {
    render(<MemoryRouter><DashboardPage /></MemoryRouter>);

    expect(await screen.findByText('628.6 KB')).toBeInTheDocument();
    expect(screen.getByText('1.3 KB')).toBeInTheDocument();
    expect(screen.queryByText('独立复用内容')).not.toBeInTheDocument();
  });
  it('links recent posts to their editors and keeps status text visible', async () => {
    dashboard.mockResolvedValueOnce({
      counts: { posts: 2, drafts: 1, clips: 0, images: 0 },
      recentPosts: [
        {
          slug: 'draft-note',
          title: '草稿笔记',
          description: '尚未发布的文章',
          publishedAt: '2026-08-17',
          updatedAt: '2026-08-18',
          draft: true,
          featured: false,
          tags: ['随笔'],
          revision: 'draft-revision',
        },
        {
          slug: 'live-note',
          title: '线上文章',
          description: '已经发布的文章',
          publishedAt: '2026-08-16',
          draft: false,
          featured: false,
          tags: ['建站'],
          revision: 'live-revision',
        },
      ],
      clipStorageBytes: 0,
      imageStorageBytes: 0,
    });

    render(<MemoryRouter><DashboardPage /></MemoryRouter>);

    expect(await screen.findByRole('link', { name: /草稿笔记/ })).toHaveAttribute('href', '/posts/draft-note');
    expect(screen.getByRole('link', { name: /线上文章/ })).toHaveAttribute('href', '/posts/live-note');
    expect(screen.getByText('草稿')).toBeInTheDocument();
    expect(screen.getByText('已发布')).toBeInTheDocument();
  });
});
