import { useCallback, useEffect, useRef, useState } from 'react';

export type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

export function useAutosave(
  save: () => Promise<void>,
  dependencies: readonly unknown[],
  delay = 2000,
  enabled = true,
) {
  const [state, setState] = useState<SaveState>('idle');
  const [error, setError] = useState<string>();
  const mounted = useRef(false);
  const saving = useRef(false);
  const queued = useRef(false);
  const saveRef = useRef(save);
  saveRef.current = save;

  const saveNow = useCallback(async () => {
    if (!enabled) return;
    if (saving.current) {
      queued.current = true;
      return;
    }
    saving.current = true;
    setState('saving');
    setError(undefined);
    try {
      await saveRef.current();
      setState('saved');
    } catch (reason) {
      setState('error');
      setError(reason instanceof Error ? reason.message : '保存失败');
      throw reason;
    } finally {
      saving.current = false;
      if (queued.current) {
        queued.current = false;
        void saveNow();
      }
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    setState('dirty');
    const timer = window.setTimeout(() => void saveNow().catch(() => undefined), delay);
    return () => window.clearTimeout(timer);
  // The caller intentionally owns the dependency list for draft changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependencies, delay, enabled, saveNow]);

  return { state, error, saveNow };
}
