'use client';

import { Fragment, useMemo, useState } from 'react';
import { Fields } from './KingdomView';
import styles from './page.module.css';
import DragScroll from './DragScroll';
import ColumnPicker, { discoverFields, useColumnLayout } from './ColumnPicker';

export type RecordRow = Record<string, unknown>;
export type RecordColumn = { key: string; label: string };
export const valueAt = (row: unknown, path: string): unknown => path.split('.').reduce<unknown>((value, key) => value && typeof value === 'object' ? (value as RecordRow)[key] : undefined, row);
const text = (value: unknown) => value == null || value === '' ? '—' : typeof value === 'number' ? value.toLocaleString('en-US', { maximumFractionDigits: 2 }) : String(value);

export function RecordTable({ rows, columns, title, onInspect }: { rows: RecordRow[]; columns: RecordColumn[]; title: string; onInspect?: (row: RecordRow) => void }) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState({ key: '', descending: false });
  const [expanded, setExpanded] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const availableColumns = useMemo(() => {
    const all = new Map(columns.map(c => [c.key, { ...c, group: 'Main columns' }]));
    for (const key of discoverFields(rows)) if (!all.has(key)) {
      const parts = key.split('.');
      const format = (v: string) => v.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, c => c.toUpperCase());
      all.set(key, { key, label: parts.slice(parts.length > 1 ? 1 : 0).map(format).join(' / '), group: parts.length > 1 ? format(parts[0]) : 'Other fields' });
    }
    return [...all.values()];
  }, [columns, rows]);
  const defaultKeys = columns.map(c => c.key);
  const layout = useColumnLayout('records:' + title + ':' + defaultKeys.join(','), defaultKeys);
  const shownColumns = layout.selected.map(key => availableColumns.find(c => c.key === key)).filter((c): c is typeof availableColumns[number] => !!c);
  const filtered = useMemo(() => rows.map((row, index) => ({ row, index })).filter(({ row }) => !search || JSON.stringify(row).toLowerCase().includes(search.toLowerCase())).sort((a, b) => {
    if (!sort.key) return a.index - b.index;
    const x = valueAt(a.row, sort.key), y = valueAt(b.row, sort.key);
    if (x == null || x === '') return y == null || y === '' ? 0 : 1;
    if (y == null || y === '') return -1;
    const cmp = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true });
    return sort.descending ? -cmp : cmp;
  }), [rows, search, sort]);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pages - 1);
  const visible = filtered.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  function download() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(filtered.map(({ row }) => Object.fromEntries(shownColumns.map(c => [c.key, valueAt(row, c.key)]))), null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`; a.click(); URL.revokeObjectURL(url);
  }
  return <section className={styles.panel}>
    <div className={styles.panelHeading}><div><h3>{title}</h3><p>Drag sideways to scroll. Sort a column or expand a row for all fields.</p></div><button className={styles.secondary} onClick={download}>Export filtered JSON ↓</button></div>
    <ColumnPicker options={availableColumns} selected={layout.selected} defaults={defaultKeys} onChange={keys => { layout.change(keys); if (!keys.includes(sort.key)) setSort({ key: '', descending: false }); }} />
    <div className={styles.recordSearch}><label>Search all fields<input type="search" placeholder="Filter these results…" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} /></label><span aria-live="polite">{filtered.length} of {rows.length} records</span></div>
    <DragScroll tabIndex={0} role="region" aria-label={`${title} table`}><table className={styles.provinceTable}><caption className={styles.srOnly}>{title}</caption><thead><tr><th scope="col">Details</th>{shownColumns.map(c => <th scope="col" key={c.key} aria-sort={sort.key === c.key ? sort.descending ? 'descending' : 'ascending' : 'none'}><button onClick={() => setSort({ key: c.key, descending: sort.key === c.key ? !sort.descending : false })}>{c.label} {sort.key === c.key ? sort.descending ? '↓' : '↑' : '↕'}</button></th>)}{onInspect && <th scope="col">Kingdom</th>}</tr></thead><tbody>{visible.map(({ row, index }) => <Fragment key={index}><tr><td><button className={styles.rowToggle} onClick={() => setExpanded(expanded === index ? null : index)} aria-expanded={expanded === index} aria-label={`${expanded === index ? 'Close' : 'Show'} details for record ${index + 1}`}>{expanded === index ? '−' : '+'}</button></td>{shownColumns.map(c => <td key={c.key} className={typeof valueAt(row, c.key) === 'number' ? styles.numeric : undefined}>{valueAt(row, c.key) !== null && typeof valueAt(row, c.key) === 'object' ? <Fields value={valueAt(row, c.key)} /> : text(valueAt(row, c.key))}</td>)}{onInspect && <td><button className={styles.secondary} onClick={() => onInspect(row)}>View intel →</button></td>}</tr>{expanded === index && <tr><td colSpan={shownColumns.length + 1 + (onInspect ? 1 : 0)}><div className={styles.detailContent}><Fields value={row} /></div></td></tr>}</Fragment>)}</tbody></table></DragScroll>
    <div className={styles.pagination}><label>Rows per page<select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(0); }}><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option></select></label><span>Page {currentPage + 1} of {pages}</span><button className={styles.secondary} disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous</button><button className={styles.secondary} disabled={currentPage + 1 >= pages} onClick={() => setPage(currentPage + 1)}>Next</button></div>
    {!filtered.length && <div className={styles.empty}><h3>{rows.length ? 'No matching records' : 'No reports available'}</h3><p>{rows.length ? 'Try a different search.' : 'The service returned no records for this selection.'}</p></div>}
  </section>;
}
