// @vitest-environment jsdom

import React, { useState } from 'react';
import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAutosave } from '../admin/client/src/hooks/useAutosave';

afterEach(() => vi.useRealTimers());

function Harness({ save }: { save: () => Promise<string> }) {
  const [value, setValue] = useState('initial');
  const persist = async () => {
    const normalized = await save();
    setValue('normalized');
    return normalized;
  };
  const { state } = useAutosave(persist, [value], 800, true, () => value);
  return <button type="button" onClick={() => { setValue('changed'); }} data-state={state}>change</button>;
}


function ManualSaveHarness({ save }: { save: () => Promise<string> }) {
  const [value, setValue] = useState('initial');
  const { saveNow } = useAutosave(save, [value], 800, true, () => value);
  return (
    <div>
      <button type="button" onClick={() => setValue('changed')}>change for manual</button>
      <button type="button" onClick={() => void saveNow()}>manual save</button>
    </div>
  );
}
describe('useAutosave', () => {
  it('debounces user changes and does not save again when the server normalizes the draft', async () => {
    vi.useFakeTimers();
    const save = vi.fn().mockResolvedValue('normalized');
    render(<Harness save={save} />);

    await act(async () => {
      screen.getByRole('button', { name: 'change' }).click();
      await vi.advanceTimersByTimeAsync(799);
    });
    expect(save).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(save).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600);
    });
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('forces a queued manual save even when an automatic save already persisted the same fingerprint', async () => {
    vi.useFakeTimers();
    let finishAutomatic: ((value: string) => void) | undefined;
    const save = vi.fn()
      .mockImplementationOnce(() => new Promise<string>((resolve) => { finishAutomatic = resolve; }))
      .mockResolvedValueOnce('changed');
    render(<ManualSaveHarness save={save} />);

    await act(async () => {
      screen.getByRole('button', { name: 'change for manual' }).click();
      await vi.advanceTimersByTimeAsync(800);
    });
    expect(save).toHaveBeenCalledTimes(1);

    await act(async () => {
      screen.getByRole('button', { name: 'manual save' }).click();
      finishAutomatic?.('changed');
      await Promise.resolve();
    });

    expect(save).toHaveBeenCalledTimes(2);
  });
});
