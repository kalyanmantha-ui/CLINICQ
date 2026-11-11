import { useCallback, useEffect, useState } from 'react';
import { errText } from './api';

/** Load data on mount (and on reload()). Optional polling keeps screens like offers fresh. */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[] = [], pollMs = 0) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(() => fn().then((d) => { setData(d); setError(null); }).catch((e) => setError(errText(e))).finally(() => setLoading(false)), deps);
  useEffect(() => { run(); }, [run]);
  useEffect(() => { if (!pollMs) return; const t = setInterval(run, pollMs); return () => clearInterval(t); }, [run, pollMs]);
  return { data, error, loading, reload: run };
}

export function useNow(everyMs = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), everyMs); return () => clearInterval(t); }, [everyMs]);
  return now;
}
