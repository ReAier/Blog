// @vitest-environment jsdom
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../admin/client/src/api/client';
import { ConfirmDialogProvider } from '../admin/client/src/context/ConfirmDialogContext';
import { ImagesPage } from '../admin/client/src/pages/ImagesPage';

describe('image library Markdown copy', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('copies the public website image URL and dismisses the success notice automatically', async () => {
    vi.spyOn(api, 'listImages').mockResolvedValue({
      items: [{
        id: 'image-id',
        name: 'picture.webp',
        originalName: 'picture.webp',
        url: '/api/images/image-id/content',
        publicUrl: 'https://blog.reaier.top/media/picture.webp',
        markdownPath: '../images/picture.webp',
        width: 1200,
        height: 800,
        byteSize: 1024,
        createdAt: '2026-08-16T03:11:00.000Z',
      }],
      total: 1,
      page: 1,
      pageSize: 20,
    });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    render(<ConfirmDialogProvider><ImagesPage /></ConfirmDialogProvider>);
    const copyButton = await screen.findByRole('button', { name: '复制 Markdown' });
    expect(screen.queryByText(/引用|未使用/)).toBeNull();

    vi.useFakeTimers();
    fireEvent.click(copyButton);
    await act(async () => undefined);

    expect(writeText).toHaveBeenCalledWith('![picture.webp](https://blog.reaier.top/media/picture.webp)');
    expect(screen.getByRole('status').textContent).toContain('Markdown 已复制到剪贴板。');

    act(() => vi.advanceTimersByTime(3_000));
    expect(screen.queryByRole('status')).toBeNull();
  });
});

