import { useEffect, useRef } from 'react';

/**
 * Calls `fn` every `ms` while `enabled` and the document is visible, and once when it becomes
 * visible again. A call still in flight is never overlapped.
 */
export function useVisiblePolling(fn: () => Promise<void>, ms: number, enabled: boolean): void {
  const latest = useRef(fn);
  useEffect(() => {
    latest.current = fn;
  });

  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    let inFlight = false;
    const tick = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        await latest.current();
      } catch {
        // Keep polling; the next tick may succeed.
      } finally {
        inFlight = false;
      }
    };
    const start = () => {
      timer ??= setInterval(() => void tick(), ms);
    };
    const stop = () => {
      clearInterval(timer);
      timer = undefined;
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void tick();
        start();
      } else {
        stop();
      }
    };
    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [ms, enabled]);
}
