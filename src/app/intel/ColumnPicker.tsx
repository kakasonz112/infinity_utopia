'use client';

import { useEffect, useState } from 'react';
import styles from './page.module.css';

export type ColumnOption = { key: string; label: string; group?: string; required?: boolean };

export function useColumnLayout(name: string, defaults: string[]) {
  const [layouts, setLayouts] = useState<Record<string, string[]>>({});
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(`intel-columns:${name}`) ?? 'null');
      if (Array.isArray(stored) && stored.every(v => typeof v === 'string')) setLayouts(old => ({ ...old, [name]: stored }));
    } catch { /* Layout controls also work when browser storage is unavailable. */ }
  }, [name]);
  const selected = layouts[name] ?? defaults;
  function change(keys: string[]) {
    setLayouts(old => ({ ...old, [name]: keys }));
    try { localStorage.setItem(`intel-columns:${name}`, JSON.stringify(keys)); } catch { /* Session-only layout. */ }
  }
  return { selected, change };
}

export default function ColumnPicker({ options, selected, defaults, onChange }: {
  options: ColumnOption[]; selected: string[]; defaults: string[]; onChange: (keys: string[]) => void;
}) {
  const [query, setQuery] = useState('');
  const chosen = new Set([...selected, ...options.filter(c => c.required).map(c => c.key)]);
  const matches = options.filter(c => `${c.label} ${c.group ?? ''} ${c.key}`.toLowerCase().includes(query.toLowerCase()));
  const groups = Array.from(new Set(matches.map(c => c.group ?? 'Columns')));
  const visibleCount = options.filter(c => chosen.has(c.key)).length;
  function toggle(key: string) {
    const next = new Set(chosen);
    if (next.has(key)) next.delete(key); else next.add(key);
    onChange([...next]);
  }
  return <details className={styles.columnPicker}>
    <summary>Columns <span>{visibleCount} / {options.length}</span></summary>
    <div className={styles.columnPanel}>
      <div className={styles.columnActions}><label>Find a column<input type="search" placeholder="Search fields or categories…" value={query} onChange={e => setQuery(e.target.value)} /></label><button type="button" onClick={() => onChange(options.map(c => c.key))}>Show all</button><button type="button" onClick={() => onChange(options.filter(c => c.required).length ? options.filter(c => c.required).map(c => c.key) : options.slice(0, 1).map(c => c.key))}>Minimal</button><button type="button" onClick={() => onChange(defaults)}>Reset view</button></div>
      <p>Choose the fields shown in this table. Layouts are saved in this browser.</p>
      <div className={styles.columnGroups}>{groups.map(group => <fieldset key={group}><legend>{group}</legend>{matches.filter(c => (c.group ?? 'Columns') === group).map(c => <label key={c.key} title={c.key}><input type="checkbox" checked={chosen.has(c.key)} disabled={c.required || chosen.has(c.key) && visibleCount <= 1} onChange={() => toggle(c.key)} /><span>{c.label}{c.required ? ' (always shown)' : ''}</span></label>)}</fieldset>)}</div>
      {!matches.length && <p>No matching columns.</p>}
    </div>
  </details>;
}

/** Include every scalar field and retain arrays as complete detail columns. */
export function discoverFields(rows: Record<string, unknown>[], prefix = ''): string[] {
  const fields = new Set<string>();
  function visit(value: unknown, path: string) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const [key, child] of Object.entries(value)) visit(child, path ? `${path}.${key}` : key);
    } else if (path) fields.add(path);
  }
  for (const row of rows) visit(row, prefix);
  return [...fields];
}
