import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';

/**
 * Debounced autosave that never loses the last edit: pending saves are flushed when the
 * component unmounts, the tab is hidden, or the page is closed.
 */
export function useDebouncedSave<T>(save: (value: T) => Promise<void> | void, delay = 400) {
  const pending = useRef<{ value: T } | null>(null);
  const timer = useRef<number | null>(null);
  const saveRef = useRef(save);
  useLayoutEffect(() => {
    saveRef.current = save;
  });

  /** Saves any pending value now. Await it before acting on what's stored. */
  const flush = useCallback(async (): Promise<void> => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const p = pending.current;
    pending.current = null;
    if (p) await saveRef.current(p.value);
  }, []);

  const schedule = useCallback(
    (value: T) => {
      pending.current = { value };
      if (timer.current) clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void flush(), delay);
    },
    [delay, flush],
  );

  useEffect(() => {
    const onHide = () => document.visibilityState === 'hidden' && void flush();
    const onPageHide = () => void flush();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onPageHide);
      void flush();
    };
  }, [flush]);

  return { schedule, flush };
}
