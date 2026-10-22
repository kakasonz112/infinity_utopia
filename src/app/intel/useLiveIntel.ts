'use client';

import { useEffect, useState } from 'react';

/** Never reuse section data on navigation; discard responses for older targets. */
export function useLiveIntel<T>(url: string, revision: number) {
  const key = `${url}|${revision}`;
  const [state, setState] = useState<{ key: string; data: T | null; error: string; loading: boolean; fetchedAt: string }>({ key: '', data: null, error: '', loading: true, fetchedAt: '' });
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setState({ key, data: null, error: '', loading: true, fetchedAt: '' });
    const timeout = setTimeout(() => controller.abort(), 60000);
    void (async () => {
      try {
        const response = await fetch(url, { cache: 'no-store', signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Intel could not be loaded. Please try refreshing.');
        if (active) setState({ key, data, loading: false, error: '', fetchedAt: data.fetchedAt ?? new Date().toISOString() });
      } catch (error) {
        if (active) setState({ key, data: null, loading: false, fetchedAt: '', error: controller.signal.aborted ? 'The intel service took too long to respond. Please refresh to try again.' : error instanceof Error ? error.message : 'Unable to load intel.' });
      } finally { clearTimeout(timeout); }
    })();
    return () => { active = false; controller.abort(); clearTimeout(timeout); };
  }, [key, url]);
  return state.key === key ? state : { key, data: null, error: '', loading: true, fetchedAt: '' };
}
