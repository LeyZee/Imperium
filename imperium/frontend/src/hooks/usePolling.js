import { useEffect, useRef, useCallback } from 'react';

/**
 * Auto-polling hook. Calls `fetchFn` every `intervalMs` while the component is mounted
 * and the tab is visible. Pauses when tab is hidden.
 *
 * @param {Function} fetchFn - Async function to call periodically
 * @param {number} intervalMs - Polling interval in ms (default 30000)
 * @param {boolean} enabled - Whether polling is active (default true)
 */
export default function usePolling(fetchFn, intervalMs = 30000, enabled = true) {
  const timerRef = useRef(null);
  const fetchRef = useRef(fetchFn);
  fetchRef.current = fetchFn;

  const startPolling = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      try { fetchRef.current(); } catch { /* ignore */ }
    }, intervalMs);
  }, [intervalMs]);

  const stopPolling = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!enabled) { stopPolling(); return; }

    startPolling();

    // Pause when tab is hidden, resume when visible
    const handleVisibility = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        // Immediate fetch on resume + restart interval
        try { fetchRef.current(); } catch { /* ignore */ }
        startPolling();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [enabled, startPolling, stopPolling]);
}
