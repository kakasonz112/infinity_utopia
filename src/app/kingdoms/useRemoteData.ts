'use client';
import { useEffect, useState } from 'react';

export function useRemoteData<T>(url: string, parse: (payload: unknown) => T) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 15000);
    setLoading(true);
    setError('');
    (async () => {
      try {
        const response = await fetch(url, { signal: controller.signal, cache: 'no-store' });
        if (!response.ok) throw new Error('Request failed');
        const next = parse(await response.json());
        if (!cancelled) setData(next);
      } catch {
        if (!cancelled) setError(timedOut ? 'Request timed out after 15 seconds. Please retry.' : 'Could not load valid data. Please retry.');
      } finally {
        clearTimeout(timer);
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; clearTimeout(timer); controller.abort(); };
  }, [url, parse, attempt]);
  return { data, loading, error, refresh: () => setAttempt(n => n + 1) };
}
