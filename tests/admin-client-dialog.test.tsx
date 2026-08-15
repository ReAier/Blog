// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React, { useRef, useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Dialog } from '../admin/client/src/components/Dialog';

beforeEach(() => { window.scrollTo = vi.fn(); });
afterEach(() => cleanup());

function Harness({ onClose = vi.fn() }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  const initialFocusRef = useRef<HTMLButtonElement>(null);
  const close = () => {
    setOpen(false);
    onClose();
  };
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Trigger</button>
      {open && (
        <Dialog
          ariaLabelledBy="dialog-title"
          initialFocusRef={initialFocusRef}
          onClose={close}
        >
          <h2 id="dialog-title">Shared dialog</h2>
          <button ref={initialFocusRef} type="button" onClick={close}>Cancel</button>
          <button type="button">Accept</button>
        </Dialog>
      )}
    </>
  );
}

describe('shared dialog foundation', () => {
  it('locks scrolling, focuses safely, traps focus, and restores the trigger', async () => {
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Trigger' });
    trigger.focus();
    fireEvent.click(trigger);

    expect(await screen.findByRole('dialog', { name: 'Shared dialog' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    expect(document.documentElement.style.overflow).toBe('hidden');

    const dialog = screen.getByRole('dialog');
    const accept = screen.getByRole('button', { name: 'Accept' });
    accept.focus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(document.documentElement.style.overflow).toBe('');
  });

  it('requests close from Escape and the backdrop', () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Trigger' }));
    const dialog = screen.getByRole('dialog');

    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Trigger' }));
    const reopenedDialog = screen.getByRole('dialog');
    fireEvent.mouseDown(reopenedDialog.parentElement!);
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
