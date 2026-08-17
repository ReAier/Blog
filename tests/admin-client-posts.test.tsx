// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ConfirmDialogProvider } from '../admin/client/src/context/ConfirmDialogContext';
import { PostsPage } from '../admin/client/src/pages/PostsPage';
import type { PostPageResult, PostSummary } from '../admin/client/src/types';

const apiMocks = vi.hoisted(() => ({
  listPosts: vi.fn(),
  importPost: vi.fn(),
}));

vi.mock('../admin/client/src/api/client', () => ({
  api: apiMocks,
}));

function post(slug: string, draft = false, deleted = false): PostSummary {
  return {
    slug,
    title: slug,
    description: `${slug} description`,
    publishedAt: '2026-08-16',
    updatedAt: '2026-08-16',
    draft,
    featured: false,
    tags: [],
    revision: `${slug}-revision`,
    deleted,
  };
}

function page(items: PostSummary[]): PostPageResult {
  return {
    items,
    total: items.length,
    page: 1,
    pageSize: 50,
    counts: {
      all: items.filter((item) => !item.deleted).length,
      published: items.filter((item) => !item.deleted && !item.draft).length,
      drafts: items.filter((item) => !item.deleted && item.draft).length,
      deleted: items.filter((item) => item.deleted).length,
    },
  };
}

function renderPage() {
  return render(<ConfirmDialogProvider><MemoryRouter><PostsPage /></MemoryRouter></ConfirmDialogProvider>);
}

describe('article list', () => {
  beforeEach(() => {
    apiMocks.listPosts.mockReset();
    apiMocks.importPost.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('keeps deleted articles out of the article page and removes the old trash filter', async () => {
    const active = [post('published-one'), post('published-two'), post('draft-one', true)];
    apiMocks.listPosts.mockResolvedValue(page(active));

    renderPage();

    expect(await screen.findByRole('button', { name: '全部 3' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '已发布 2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '草稿 1' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /回收站/ })).not.toBeInTheDocument();
    await waitFor(() => expect(apiMocks.listPosts).not.toHaveBeenCalledWith({ includeDeleted: true }));
  });

  it('uses a row-wide article link without visible edit copy', async () => {
    apiMocks.listPosts.mockResolvedValue(page([post('published-one')]));

    renderPage();

    const link = await screen.findByRole('link', { name: '打开文章 published-one' });
    expect(link).toHaveAttribute('href', '/posts/published-one');
    expect(link).toHaveClass('row-stretched-link');
    expect(screen.queryByText('编辑 →')).not.toBeInTheDocument();
  });
});
