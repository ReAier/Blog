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

function importInput(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error('Expected clipboard import file input');
  return input;
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


  it('renders Clips as a row-wide list without card edit chrome', async () => {
    const cpp = clip('cpp-sample', 'cpp');
    apiMocks.listClips.mockResolvedValue(page([cpp]));

    renderPage();

    expect(await screen.findByRole('table', { name: '剪切板列表' })).toBeInTheDocument();
    const link = screen.getByRole('link', { name: '打开剪切内容 cpp sample' });
    expect(link).toHaveAttribute('href', '/clips/cpp-sample');
    expect(link).toHaveClass('row-stretched-link');
    expect(screen.queryByText('编辑 →')).not.toBeInTheDocument();
    expect(screen.queryByText('引用')).not.toBeInTheDocument();
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
    fireEvent.click(await screen.findByRole('button', { name: '移入回收站' }));
    await waitFor(() => expect(apiMocks.deleteClip).toHaveBeenCalledWith('cpp-sample'));
    await screen.findByText('已将剪切内容移入回收站：cpp sample。');
    expect(apiMocks.listClips).toHaveBeenCalledTimes(2);
  });

  it('keeps the clip and displays unexpected server errors during deletion', async () => {
    const cpp = clip('cpp-sample', 'cpp');
    apiMocks.listClips.mockResolvedValue(page([cpp]));
    apiMocks.deleteClip.mockRejectedValue(new Error('服务器暂时不可用'));

    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: '删除 cpp sample' }));
    fireEvent.click(await screen.findByRole('button', { name: '移入回收站' }));

    expect(await screen.findByRole('status')).toHaveTextContent('服务器暂时不可用');
    expect(screen.getByRole('link', { name: '打开剪切内容 cpp sample' })).toBeInTheDocument();
  });

  it('limits the picker and preselects the language from a supported file', async () => {
    apiMocks.listClips.mockResolvedValue(page([]));
    const { container } = renderPage();
    const input = importInput(container);

    expect(input).toHaveAttribute(
      'accept',
      '.txt,.ts,.js,.mjs,.cjs,.tsx,.jsx,.py,.c,.h,.cc,.cpp,.cxx,.hpp,.hxx',
    );

    fireEvent.change(input, {
      target: { files: [new File(['const value = 1;'], 'sample.component.TSX', { type: 'text/plain' })] },
    });

    expect(await screen.findByRole('heading', { name: '导入剪切内容' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '标题' })).toHaveValue('sample.component');
    expect(screen.getAllByRole('combobox', { name: '语言' })).toHaveLength(2);
    expect(screen.getAllByRole('combobox', { name: '语言' })[1]).toHaveTextContent('TSX');
  });

  it('keeps the detected language editable before import', async () => {
    apiMocks.listClips.mockResolvedValue(page([]));
    const { container } = renderPage();

    fireEvent.change(importInput(container), {
      target: { files: [new File(['print(1)'], 'script.py', { type: 'text/plain' })] },
    });

    const languageSelect = (await screen.findAllByRole('combobox', { name: '语言' }))[1];
    expect(languageSelect).toHaveTextContent('Python');
    fireEvent.click(languageSelect);
    fireEvent.click(screen.getByRole('option', { name: '纯文本' }));
    expect(languageSelect).toHaveTextContent('纯文本');
  });

  it('rejects unsupported files without opening the import dialog', async () => {
    apiMocks.listClips.mockResolvedValue(page([]));
    const { container } = renderPage();
    const input = importInput(container);

    fireEvent.change(input, {
      target: { files: [new File(['binary'], 'archive.zip', { type: 'application/zip' })] },
    });

    expect(await screen.findByText(/不支持文件类型：archive\.zip/)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '导入剪切内容' })).not.toBeInTheDocument();
    expect(input.value).toBe('');
    expect(apiMocks.importClip).not.toHaveBeenCalled();
  });
});
