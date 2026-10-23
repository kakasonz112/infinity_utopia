'use client';

import { useEffect, useState } from 'react';

export function useRowHighlights(name: string) {
  const [saved, setSaved] = useState<Record<string, number[]>>({});
  useEffect(() => {
    try {
      const value = JSON.parse(localStorage.getItem(`intel-highlights:${name}`) ?? 'null');
      if (Array.isArray(value) && value.every(id => Number.isSafeInteger(id))) setSaved(old => ({ ...old, [name]: value }));
    } catch { /* Highlighting remains usable without storage. */ }
  }, [name]);
  const ids = saved[name] ?? [];
  function change(next: number[]) {
    setSaved(old => ({ ...old, [name]: next }));
    try { localStorage.setItem(`intel-highlights:${name}`, JSON.stringify(next)); } catch { /* Session-only highlighting. */ }
  }
  return {
    has: (id: number) => ids.includes(id),
    size: ids.length,
    toggle: (id: number) => change(ids.includes(id) ? ids.filter(value => value !== id) : [...ids, id]),
    clear: () => change([]),
  };
}
