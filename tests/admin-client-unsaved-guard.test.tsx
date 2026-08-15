// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, Link, RouterProvider } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useUnsavedChangesGuard } from '../admin/client/src/hooks/useUnsavedChangesGuard';

afterEach(() => cleanup());

function GuardedPage({
  dirty,
  confirm,
}: {
  dirty: boolean;
  confirm: () => Promise<boolean>;
}) {
  useUnsavedChangesGuard(dirty, confirm);
  return <Link to="/next">Next</Link>;
}

function renderGuard(dirty: boolean, confirm: () => Promise<boolean>) {
  const router = createMemoryRouter([
    { path: '/', element: <GuardedPage dirty={dirty} confirm={confirm} /> },
    { path: '/next', element: <p>Next page</p> },
  ], { initialEntries: ['/'] });
  render(<RouterProvider router={router} />);
  return router;
}

describe('unsaved editor navigation guard', () => {
  it('prevents browser unload while changes are unsaved', () => {
    renderGuard(true, async () => false);
    const event = new Event('beforeunload', { cancelable: true });

    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  it('keeps the editor open when internal navigation is cancelled', async () => {
    const confirm = vi.fn().mockResolvedValue(false);
    const router = renderGuard(true, confirm);

    fireEvent.click(screen.getByRole('link', { name: 'Next' }));

    await waitFor(() => expect(confirm).toHaveBeenCalledTimes(1));
    expect(router.state.location.pathname).toBe('/');
  });

  it('continues internal navigation after confirmation', async () => {
    const router = renderGuard(true, vi.fn().mockResolvedValue(true));

    fireEvent.click(screen.getByRole('link', { name: 'Next' }));

    await screen.findByText('Next page');
    expect(router.state.location.pathname).toBe('/next');
  });
});
