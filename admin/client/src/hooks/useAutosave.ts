import { useCallback, useEffect, useRef, useState } from 'react';

export type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';
type Fingerprint = () => string;

export function useAutosave(
  save: () => Promise<string | void>,
  dependencies: readonly unknown[],
  delay = 800,
  enabled = true,
  fingerprint: Fingerprint = () => JSON.stringify(dependencies),
  resetKey?: unknown,
) {
  const [state, setState] = useState<SaveState>('idle');
  const [error, setError] = useState<string>();
  const mounted = useRef(false);
  const saving = useRef(false);
  const queued = useRef(false);
  const queuedForce = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  const baseline = useRef<string | undefined>(undefined);
  const saveRef = useRef(save);
  const fingerprintRef = useRef(fingerprint);
  const dependenciesFingerprintRef = useRef('');
  const resetKeyRef = useRef(resetKey);
  saveRef.current = save;
  fingerprintRef.current = fingerprint;
  dependenciesFingerprintRef.current = fingerprint();

  const clearTimer = useCallback(() => {
    if (timer.current !== undefined) {
      window.clearTimeout(timer.current);
      timer.current = undefined;
    }
  }, []);

  const saveNow = useCallback(async (force = true) => {
    if (!enabled) return;
    clearTimer();
    if (saving.current) {
      queued.current = true;
      queuedForce.current ||= force;
      return;
    }
    saving.current = true;
    setState('saving');
    setError(undefined);
    const submittedFingerprint = dependenciesFingerprintRef.current;
    try {
      const savedFingerprint = await saveRef.current();
      baseline.current = savedFingerprint ?? submittedFingerprint;
      setState('saved');
    } catch (reason) {
      setState('error');
      setError(reason instanceof Error ? reason.message : '保存失败');
      throw reason;
    } finally {
      saving.current = false;
      if (queued.current) {
        queued.current = false;
        const forceQueuedSave = queuedForce.current;
        queuedForce.current = false;
        if (forceQueuedSave) {
          void saveNow(true).catch(() => undefined);
        } else if (dependenciesFingerprintRef.current !== baseline.current) {
          setState('dirty');
          timer.current = window.setTimeout(() => void saveNow(false).catch(() => undefined), delay);
        }
      }
    }
  }, [clearTimer, delay, enabled]);

  useEffect(() => {
    const currentFingerprint = fingerprintRef.current();
    dependenciesFingerprintRef.current = currentFingerprint;
    if (!mounted.current || resetKeyRef.current !== resetKey) {
      mounted.current = true;
      resetKeyRef.current = resetKey;
      baseline.current = currentFingerprint;
      clearTimer();
      return;
    }
    if (currentFingerprint === baseline.current) return;
    setState('dirty');
    clearTimer();
    if (enabled) timer.current = window.setTimeout(() => void saveNow(false).catch(() => undefined), delay);
    return clearTimer;
  // The caller intentionally owns the dependency list for draft changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependencies, delay, enabled, resetKey, clearTimer, saveNow]);

  useEffect(() => clearTimer, [clearTimer]);

  return { state, error, saveNow };
}
