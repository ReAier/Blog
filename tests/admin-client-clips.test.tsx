// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ConfirmDialogProvider } from '../admin/client/src/context/ConfirmDialogContext';
import { ClipsPage } from '../admin/client/src/pages/ClipsPage';
import type { ClipPageResult, ClipSummary } from '../admin/client/src/types';

const apiMocks = vi.hoisted(() => ({
  listClips: vi.fn(),
  deleteClip: vi.fn(),
  importClip: vi.fn(),
}));

vi.mock('../admin/client/src/api/client', () => ({
  api: apiMocks,
}));

function clip(slug: string, language: string): ClipSummary {
  return {
    slug,
    title: `${language} sample`,
    description: `${language} description`,
    language,
    file: `${slug}.${language === 'cpp' ? 'cpp' : 'ts'}`,
    updatedAt: '2026-08-15',
    revision: `${slug}-revision`,
    references: [],
  };
}

function page(items: ClipSummary[], languages = ['cpp', 'typescript']): ClipPageResult {
  return {
    items,
    languages,
    total: items.length,
    page: 1,
    pageSize: 50,
  };
}

function renderPage() {
  return render(<ConfirmDialogProvider><MemoryRouter><ClipsPage /></MemoryRouter></ConfirmDialogProvider>);
}

describe('clipboard list', () => {
  beforeEach(() => {
    apiMocks.listClips.mockReset();
    apiMocks.deleteClip.mockReset();
    apiMocks.importClip.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('keeps every language option after filtering the visible clips', async () => {
    const cpp = clip('cpp-sample', 'cpp');
    const typescript = clip('ts-sample', 'typescript');
    apiMocks.listClips.mockImplementation(async ({ language }: { language?: string }) => (
      language === 'cpp' ? page([cpp]) : page([cpp, typescript])
    ));

    renderPage();
    const select = await screen.findByRole('combobox', { name: '语言' });
    fireEvent.click(select);
    fireEvent.click(screen.getByRole('option', { name: 'C / C++' }));

    await waitFor(() => expect(apiMocks.listClips).toHaveBeenLastCalledWith({ query: '', language: 'cpp' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'typescript sample' })).not.toBeInTheDocument());

    fireEvent.click(select);
    expect(screen.getAllByRole('option').map((option) => option.textContent?.replace('✓', ''))).toEqual([
      '全部',
      'C / C++',
      'TypeScript',
    ]);
  });

  it('cancels or confirms deletion without navigating through the card', async () => {
    const cpp = clip('cpp-sample', 'cpp');
    apiMocks.listClips
      .mockResolvedValueOnce(page([cpp]))
      .mockResolvedValueOnce(page([], ['typescript']));
    apiMocks.deleteClip.mockResolvedValue({ ok: true });
    renderPage();
    const deleteButton = await screen.findByRole('button', { name: '删除 cpp sample' });
    fireEvent.click(deleteButton);
    fireEvent.click(await screen.findByRole('button', { name: '取消' }));
    expect(apiMocks.deleteClip).not.toHaveBeenCalled();

    fireEvent.click(deleteButton);
    fireEvent.click(await screen.findByRole('button', { name: '确认删除' }));
    await waitFor(() => expect(apiMocks.deleteClip).toHaveBeenCalledWith('cpp-sample'));
    await screen.findByText('已删除剪切内容：cpp sample。');
    expect(apiMocks.listClips).toHaveBeenCalledTimes(2);
  });

  it('keeps the clip and displays the server error when deletion is rejected', async () => {
    const cpp = clip('cpp-sample', 'cpp');
    apiMocks.listClips.mockResolvedValue(page([cpp]));
    apiMocks.deleteClip.mockRejectedValue(new Error('该剪切内容仍被文章引用'));

    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: '删除 cpp sample' }));
    fireEvent.click(await screen.findByRole('button', { name: '确认删除' }));

    expect(await screen.findByRole('status')).toHaveTextContent('该剪切内容仍被文章引用');
    expect(screen.getByRole('heading', { name: 'cpp sample' })).toBeInTheDocument();
  });
});
