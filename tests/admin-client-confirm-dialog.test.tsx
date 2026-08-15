// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import React, { useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ConfirmDialogProvider,
  useConfirmDialog,
} from '../admin/client/src/context/ConfirmDialogContext';

function Harness() {
  const confirm = useConfirmDialog();
  const [result, setResult] = useState('等待选择');

  const open = async () => {
    const accepted = await confirm({
      eyebrow: 'Danger zone',
      title: '删除内容？',
      message: '删除后无法撤销。',
      confirmLabel: '确认删除',
      tone: 'danger',
    });
    setResult(accepted ? '已确认' : '已取消');
  };

  return (
    <>
      <button type="button" onClick={() => void open()}>打开确认窗口</button>
      <output>{result}</output>
    </>
  );
}

function renderHarness() {
  return render(<ConfirmDialogProvider><Harness /></ConfirmDialogProvider>);
}

afterEach(() => cleanup());

describe('site confirmation dialog', () => {
  it('uses safe initial focus, confirms, and restores focus to the trigger', async () => {
    renderHarness();
    const trigger = screen.getByRole('button', { name: '打开确认窗口' });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = await screen.findByRole('alertdialog', { name: '删除内容？' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText('删除后无法撤销。')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '取消' })).toHaveFocus();

    fireEvent.click(screen.getByRole('button', { name: '确认删除' }));
    await screen.findByText('已确认');
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('cancels with the cancel button or Escape key', async () => {
    renderHarness();
    const trigger = screen.getByRole('button', { name: '打开确认窗口' });

    fireEvent.click(trigger);
    fireEvent.click(await screen.findByRole('button', { name: '取消' }));
    await screen.findByText('已取消');

    fireEvent.click(trigger);
    fireEvent.keyDown(await screen.findByRole('alertdialog'), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(screen.getByText('已取消')).toBeInTheDocument();
  });

  it('cancels from the backdrop and traps focus inside the dialog', async () => {
    renderHarness();
    fireEvent.click(screen.getByRole('button', { name: '打开确认窗口' }));

    const dialog = await screen.findByRole('alertdialog');
    const cancel = screen.getByRole('button', { name: '取消' });
    const accept = screen.getByRole('button', { name: '确认删除' });
    accept.focus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(cancel).toHaveFocus();

    const backdrop = dialog.parentElement;
    expect(backdrop).not.toBeNull();
    fireEvent.mouseDown(backdrop!);
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(screen.getByText('已取消')).toBeInTheDocument();
  });
});

describe('confirmation dialog infrastructure', () => {
  it('uses the shared dialog foundation rather than duplicating focus logic', async () => {
    const source = await readFile(
      join(process.cwd(), 'admin', 'client', 'src', 'context', 'ConfirmDialogContext.tsx'),
      'utf8',
    );

    expect(source).toContain("import { Dialog } from '../components/Dialog'");
    expect(source).not.toContain('querySelectorAll<HTMLElement>');
    expect(source).not.toContain("document.body.style.overflow = 'hidden'");
  });
});
