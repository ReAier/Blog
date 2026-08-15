import { useEffect } from 'react';
import { useBlocker } from 'react-router-dom';

export type ConfirmUnsavedChanges = () => Promise<boolean>;

export function useUnsavedChangesGuard(
  active: boolean,
  confirmNavigation: ConfirmUnsavedChanges,
  bypassRef?: { current: boolean },
) {
  useEffect(() => {
    if (!active) return;
    const preventUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      Object.defineProperty(event, 'returnValue', { configurable: true, value: '' });
    };
    window.addEventListener('beforeunload', preventUnload);
    return () => window.removeEventListener('beforeunload', preventUnload);
  }, [active]);

  const blocker = useBlocker(({ currentLocation, nextLocation }) => (
    active
    && !bypassRef?.current
    && currentLocation.pathname !== nextLocation.pathname
  ));

  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    let cancelled = false;
    void confirmNavigation().then((accepted) => {
      if (cancelled || blocker.state !== 'blocked') return;
      if (accepted) blocker.proceed();
      else blocker.reset();
    });
    return () => {
      cancelled = true;
    };
  }, [blocker, confirmNavigation]);
}
