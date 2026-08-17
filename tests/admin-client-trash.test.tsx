// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfirmDialogProvider } from '../admin/client/src/context/ConfirmDialogContext';
import { TrashPage } from '../admin/client/src/pages/TrashPage';

const apiMocks = vi.hoisted(() => ({
  listTrash: vi.fn(),
  restoreTrashItem: vi.fn(),
  deleteTrashItem: vi.fn(),
}));

vi.mock('../admin/client/src/api/client', () => ({ api: apiMocks }));

describe('unified trash page', () => {
  beforeEach(() => {
    apiMocks.listTrash.mockReset();
    apiMocks.restoreTrashItem.mockReset();
    apiMocks.deleteTrashItem.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('lists posts, clips, and images together and restores an item', async () => {
    apiMocks.listTrash
      .mockResolvedValueOnce({ items: [
        { id: 'post-one', type: 'post', title: '文章一', detail: 'post-one', deletedAt: '2026-08-17T08:00:00.000Z' },
        { id: 'clip-id', type: 'clip', title: '代码一', detail: 'sample.ts', deletedAt: '2026-08-17T07:00:00.000Z' },
        { id: 'image-id', type: 'image', title: 'image.webp', detail: 'image.webp', deletedAt: '2026-08-17T06:00:00.000Z' },
      ] })
      .mockResolvedValueOnce({ items: [] });
    apiMocks.restoreTrashItem.mockResolvedValue({ ok: true });

    render(<ConfirmDialogProvider><TrashPage /></ConfirmDialogProvider>);

    expect(await screen.findByText('文章一')).toBeInTheDocument();
    expect(screen.getByText('代码一')).toBeInTheDocument();
    expect(screen.getAllByText('image.webp')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: '恢复 文章一' }));
    fireEvent.click(await screen.findByRole('button', { name: '确认恢复' }));

    await waitFor(() => expect(apiMocks.restoreTrashItem).toHaveBeenCalledWith('post', 'post-one'));
    expect(await screen.findByRole('status')).toHaveTextContent('已恢复：文章一。');
  });

  it('filters trash items by content type and shows per-type counts', async () => {
    apiMocks.listTrash.mockResolvedValue({ items: [
      { id: 'post-one', type: 'post', title: '文章一', detail: 'post-one', deletedAt: '2026-08-17T08:00:00.000Z' },
      { id: 'clip-id', type: 'clip', title: '代码一', detail: 'sample.ts', deletedAt: '2026-08-17T07:00:00.000Z' },
      { id: 'image-id', type: 'image', title: 'image.webp', detail: 'image.webp', deletedAt: '2026-08-17T06:00:00.000Z' },
    ] });

    render(<ConfirmDialogProvider><TrashPage /></ConfirmDialogProvider>);

    expect(await screen.findByRole('button', { name: '全部 3' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '文章 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '剪切内容 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '图片 1' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '剪切内容 1' }));
    expect(screen.getByText('代码一')).toBeInTheDocument();
    expect(screen.queryByText('文章一')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '恢复 image.webp' })).not.toBeInTheDocument();
  });


  it('permanently deletes a trash item after an irreversible confirmation', async () => {
    apiMocks.listTrash
      .mockResolvedValueOnce({ items: [
        { id: 'clip-id', type: 'clip', title: '代码一', detail: 'sample.ts', deletedAt: '2026-08-17T07:00:00.000Z' },
      ] })
      .mockResolvedValueOnce({ items: [] });
    apiMocks.deleteTrashItem.mockResolvedValue({ ok: true });

    render(<ConfirmDialogProvider><TrashPage /></ConfirmDialogProvider>);

    fireEvent.click(await screen.findByRole('button', { name: '彻底删除 代码一' }));
    expect(await screen.findByText(/删除后无法恢复/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '永久删除' }));

    await waitFor(() => expect(apiMocks.deleteTrashItem).toHaveBeenCalledWith('clip', 'clip-id'));
    expect(await screen.findByRole('status')).toHaveTextContent('已彻底删除：代码一。');
  });

});
