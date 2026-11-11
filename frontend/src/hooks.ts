import { useCallback, useEffect, useRef, useState } from 'react';
import { errText } from './api';

/**
 * Load data on mount and whenever `deps` change. Optional polling keeps screens like offers fresh, but only while the
 * tab is visible: a hidden tab stops asking, and refreshes once the person comes back.
 * Stale responses (from an older request) are ignored, so quickly changing a date never shows the wrong day.
 */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[] = [], pollMs = 0) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const latest = useRef(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(() => {
    const id = ++latest.current;
    return fn()
      .then((d) => { if (id === latest.current) { setData(d); setError(null); } })
      .catch((e) => { if (id === latest.current) setError(errText(e)); })
      .finally(() => { if (id === latest.current) setLoading(false); });
  }, deps);
  useEffect(() => { setLoading(true); run(); }, [run]);
  useEffect(() => {
    if (!pollMs) return;
    const tick = () => { if (!document.hidden) run(); };
    const t = setInterval(tick, pollMs);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', tick); };
  }, [run, pollMs]);
  /** Change the data right away (an optimistic update). The next reload() reconciles it with the server. */
  const mutate = useCallback((update: (current: T | null) => T | null) => setData(update), []);
  return { data, error, loading, reload: run, mutate };
}

export function useNow(everyMs = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), everyMs); return () => clearInterval(t); }, [everyMs]);
  return now;
}
