'use client';

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import styles from './page.module.css';
import FilterBar, { type CfFilterType, type Filters } from '../../components/FilterBar/FilterBar';
import LocalDisplay from '../../components/LocalDisplay/LocalDisplay';
import { compareKingdoms, expiryDate, kingdomKey, kingdomLabel, location, remainingTicks, summarizeSnapshot, summarizeCeasefires, type Ceasefire, type Kingdom, type Province, type Sort } from './model';

import { parseKingdoms, parseCeasefires } from './validation';
import { useRemoteData } from './useRemoteData';
const numberFormat = new Intl.NumberFormat('en', { maximumFractionDigits: 1 });
const number = (n: number | null) => n === null || !Number.isFinite(n) ? '\u2014' : numberFormat.format(n);
const initialFilters: Filters = { land: [0, 0], networth: [0, 0], provinces: [0, 25] };
const columns: { key: Sort['key']; label: string }[] = [
 { key: 'kingdomName', label: 'Kingdom' }, { key: 'location', label: 'Location' }, { key: 'honor', label: 'Honor' },
 { key: 'networth', label: 'Networth' }, { key: 'totalLand', label: 'Land (acres)' }, { key: 'provinceCount', label: 'Provinces' },
 { key: 'warsConcluded', label: 'Wars' }, { key: 'warsWon', label: 'Wins' }, { key: 'warScore', label: 'War score' }, { key: 'status', label: 'War ceasefire' },
];
const provinceColumns: { key: keyof Province; label: string }[] = [
 { key: 'slot', label: 'Slot' }, { key: 'name', label: 'Name' }, { key: 'land', label: 'Land' }, { key: 'race', label: 'Race' },
 { key: 'honorName', label: 'Honor' }, { key: 'networth', label: 'Networth' }, { key: 'protected', label: 'Protection' },
];

function ProvinceDetails({ kingdom }: { kingdom: Kingdom }) {
 const [sort, setSort] = useState<{ key: keyof Province; direction: 'ASC' | 'DESC' } | null>(null);
 const provinces = useMemo(() => {
  const rows = [...(kingdom.provinces ?? [])];
  if (sort) rows.sort((a, b) => {
   const av = a[sort.key], bv = b[sort.key];
   const comparison = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv), undefined, { numeric: true });
   return comparison * (sort.direction === 'ASC' ? 1 : -1);
  });
  return rows;
 }, [kingdom.provinces, sort]);
 const races = useMemo(() => {
  const counts: Record<string, number> = {};
  for (const p of kingdom.provinces ?? []) counts[p.race || 'Unknown'] = (counts[p.race || 'Unknown'] || 0) + 1;
  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
 }, [kingdom.provinces]);
 return <section aria-label={`Provinces in ${kingdomLabel(kingdom)}`}>
  <div className={styles.detailHeading}><strong>{kingdomLabel(kingdom)}</strong><span>{races.map(([race, count]) => `${race} ${count}`).join(' · ')}</span></div>
  <table className={styles.provinceTable}><thead><tr>{provinceColumns.map(({ key, label }) =>
   <th key={key} aria-sort={sort?.key === key ? sort.direction === 'ASC' ? 'ascending' : 'descending' : 'none'}>
    <button type="button" onClick={() => setSort(sort?.key === key ? sort.direction === 'ASC' ? { key, direction: 'DESC' } : null : { key, direction: 'ASC' })}>{label} {sort?.key === key ? sort.direction === 'ASC' ? '▲' : '▼' : ''}</button>
   </th>
  )}</tr></thead><tbody>{provinces.map(p => <tr key={p.slot}><td>#{p.slot}</td><td>{p.name}</td><td>{number(p.land)}</td><td>{p.race}</td><td>{p.honorName}</td><td>{number(p.networth)}</td><td>{p.protected ? 'Protected' : 'Unprotected'}</td></tr>)}</tbody></table>
  {!provinces.length && <p>No province details available.</p>}
 </section>;
}

function TiedLeaders({ labels }: { labels: string[] }) {
 if (labels.length < 2) return null;
 return <details className={styles.tiedLeaders}><summary>+{labels.length - 1} tied {labels.length === 2 ? 'leader' : 'leaders'}</summary><ul>{labels.map((label, index) => <li key={index}>{label}</li>)}</ul></details>;
}

export default function Kingdoms() {
 const kingdomsRequest = useRemoteData('/api/kingdoms', parseKingdoms);
 const cfRequest = useRemoteData('/api/ceasefire', parseCeasefires);
 const { data, loading, error } = kingdomsRequest;
 const ceasefire = useMemo(() => cfRequest.data?.data ?? {}, [cfRequest.data]);
 const cfState = cfRequest.data ? 'ready' : cfRequest.loading ? 'loading' : 'error';
 const cfUpdated = cfRequest.data?.lastUpdated ?? '';
 const initialized = useRef(false);
 const [now, setNow] = useState(() => Date.now());
 const [filters, setFilters] = useState<Filters>(initialFilters);
 const [appliedFilters, setAppliedFilters] = useState<Filters>(initialFilters);
 const [cfFilter, setCfFilter] = useState<CfFilterType>('ALL');
 const [sorts, setSorts] = useState<Sort[]>([]);
 const [expanded, setExpanded] = useState<Set<string>>(new Set());

 useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(timer); }, []);
 useEffect(() => { const timer = setTimeout(() => setAppliedFilters(filters), 250); return () => clearTimeout(timer); }, [filters]);
 const maxLand = useMemo(() => Math.max(0, ...(data?.kingdoms ?? []).map(k => k.totalLand)), [data]);
 const maxNetworth = useMemo(() => Math.max(0, ...(data?.kingdoms ?? []).map(k => k.networth)), [data]);
 useEffect(() => {
  if (!data || initialized.current) return;
  initialized.current = true;
  const defaults = { land: [0, Math.ceil(maxLand / 100) * 100], networth: [0, Math.ceil(maxNetworth / 50000) * 50000], provinces: [0, 25] };
  setFilters(defaults); setAppliedFilters(defaults);
 }, [data, maxLand, maxNetworth]);
 const numericMatched = useMemo(() => (data?.kingdoms ?? []).filter(k =>
  k.totalLand >= appliedFilters.land[0] && k.totalLand <= appliedFilters.land[1] && k.networth >= appliedFilters.networth[0] && k.networth <= appliedFilters.networth[1] && k.provinceCount >= appliedFilters.provinces[0] && k.provinceCount <= appliedFilters.provinces[1]
 ), [data, appliedFilters]);
 const matched = useMemo(() => cfFilter === 'ALL' ? numericMatched : numericMatched.filter(k => cfState === 'ready' && remainingTicks(ceasefire[kingdomKey(k)], now) > 0), [numericMatched, cfFilter, cfState, ceasefire, now]);
 const sortTime = sorts.some(s => s.key === 'status') ? now : 0;
 const rows = useMemo(() => [...matched].sort((a, b) => compareKingdoms(a, b, sorts, ceasefire, sortTime)), [matched, sorts, ceasefire, sortTime]);
 const snapshotStats = useMemo(() => summarizeSnapshot(matched), [matched]);
 const cfStats = useMemo(() => summarizeCeasefires(matched, ceasefire, now), [matched, ceasefire, now]);
 const stats = { ...snapshotStats, ...cfStats };
 function resetFilters() {
  const defaults = { land: [0, Math.ceil(maxLand / 100) * 100], networth: [0, Math.ceil(maxNetworth / 50000) * 50000], provinces: [0, 25] };
  setFilters(defaults); setAppliedFilters(defaults); setCfFilter('ALL');
 }
 function sortBy(key: Sort['key']) {
  setSorts(previous => {
   const current = previous.find(s => s.key === key);
   return !current ? [...previous, { key, direction: 'ASC' }] : current.direction === 'ASC' ? previous.map(s => s.key === key ? { ...s, direction: 'DESC' } : s) : previous.filter(s => s.key !== key);
  });
 }
 function toggle(key: string) { setExpanded(previous => { const next = new Set(previous); if (next.has(key)) next.delete(key); else next.add(key); return next; }); }
 const retry = kingdomsRequest.refresh;
 if (loading && !data) return <div className={styles.loadingWrapper} role="status"><div className={styles.spinner} /><p>Loading kingdoms…</p></div>;
 if (error && !data) return <main className={styles.container}><h1 className={styles.heading}>Kingdoms</h1><p role="alert">{error}</p><button type="button" onClick={retry}>Retry</button></main>;
 return <main className={styles.container}>
  <header className={styles.pageHeader}><div><p className={styles.eyebrow}>World of Legends</p><h1 className={styles.heading}>Kingdoms</h1><p className={styles.muted}>Explore kingdoms, compare war records, and track estimated war ceasefires.</p></div><div className={styles.refreshControls}><button type="button" disabled={loading} onClick={retry}>{loading ? 'Refreshing kingdoms...' : 'Refresh kingdoms'}</button><button type="button" disabled={cfRequest.loading} onClick={cfRequest.refresh}>{cfRequest.loading ? 'Refreshing CF...' : 'Refresh CF'}</button></div></header>
  <div className={styles.info}>
   <div><span>Age starts</span><LocalDisplay utcTimeString={data?.startDate} /></div>
   <div><span>Age ends</span><LocalDisplay utcTimeString={data?.endDate} /></div>
   <div><span>Kingdom snapshot</span><LocalDisplay utcTimeString={data?.lastUpdated} /></div>
   <div><span>CF checked</span>{cfState === 'ready' && cfUpdated ? <LocalDisplay utcTimeString={cfUpdated} /> : cfState === 'loading' ? 'Loading…' : cfState === 'error' ? 'Unavailable' : 'Time unavailable'}</div>
  </div>
  {cfRequest.error && <p className={styles.notice} role="alert">{cfRequest.data ? 'CF refresh failed; showing the last successful CF data. ' : 'Ceasefire data is unavailable. '}{cfRequest.error} <button type="button" disabled={cfRequest.loading} onClick={cfRequest.refresh}>Retry CF</button></p>}
  {error && data && <p className={styles.notice} role="alert">Kingdom refresh failed; showing the last successful snapshot. {error} <button type="button" disabled={loading} onClick={retry}>Retry kingdoms</button></p>}
  <FilterBar filters={filters} cfFilter={cfFilter} onFilterChange={setFilters} onCfFilterChange={setCfFilter} biggestLand={maxLand} biggestNetworth={maxNetworth} onReset={resetFilters} cfAvailable={cfState === 'ready'} />
  <section aria-label="Statistics for matching kingdoms" className={styles.statistics}>
   <div className={styles.sectionHeading}><h2>At a glance</h2><span aria-live="polite">Showing {number(matched.length)} of {number(data?.kingdoms.length ?? 0)} kingdoms · statistics follow your filters</span></div>
   <div className={styles.statGrid}>
    <article className={styles.statCard}><h3>Kingdoms & provinces</h3><strong>{number(matched.length)} kingdoms</strong><p>{number(stats.provinces)} provinces in this selection</p></article>
    <article className={styles.statCard}><h3>Kingdom land</h3><strong>{number(stats.medianLand)} acres</strong><p>Median kingdom land</p><p>{number(stats.totalLand)} acres total</p></article>
    <article className={styles.statCard}><h3>Kingdom networth</h3><strong>{number(stats.medianNetworth)} NW</strong><p>Median kingdom networth</p><p>{number(stats.totalNetworth)} NW total</p></article>
    <article className={styles.statCard}><h3>Province land</h3><strong>{number(stats.medianProvinceLand)} acres</strong><p>Median province land</p><p>{number(stats.provinceLandCount)} listed provinces measured</p></article>
    <article className={styles.statCard}><h3>Province networth</h3><strong>{number(stats.medianProvinceNetworth)} NW</strong><p>Median province networth</p><p>{number(stats.provinceNetworthCount)} listed provinces measured</p></article>
    <article className={styles.statCard}><h3>Largest kingdom by land</h3><strong>{stats.largestLand ? number(stats.largestLand.totalLand) + ' acres' : '\u2014'}</strong><p>{stats.largestLand ? kingdomLabel(stats.largestLand) : 'No matching kingdoms'}</p><TiedLeaders labels={stats.landLeaders.map(kingdomLabel)} /></article>
    <article className={styles.statCard}><h3>Highest-networth kingdom</h3><strong>{stats.largestNetworth ? number(stats.largestNetworth.networth) + ' NW' : '\u2014'}</strong><p>{stats.largestNetworth ? kingdomLabel(stats.largestNetworth) : 'No matching kingdoms'}</p><TiedLeaders labels={stats.networthLeaders.map(kingdomLabel)} /></article>
    <article className={styles.statCard}><h3>Province leaders</h3>
     <div className={styles.provinceLeader}><b>Largest by land</b><p>{stats.largestProvinceLand ? number(stats.largestProvinceLand.province.land) + ' acres \u00b7 ' + stats.largestProvinceLand.province.name : 'No land data available'}</p>{stats.largestProvinceLand && <p>{kingdomLabel(stats.largestProvinceLand.kingdom)}</p>}<TiedLeaders labels={stats.provinceLandLeaders.map(row => row.province.name + ' (' + location(row.kingdom) + ')')} /></div>
     <div className={styles.provinceLeader}><b>Highest networth</b><p>{stats.largestProvinceNetworth ? number(stats.largestProvinceNetworth.province.networth) + ' NW \u00b7 ' + stats.largestProvinceNetworth.province.name : 'No networth data available'}</p>{stats.largestProvinceNetworth && <p>{kingdomLabel(stats.largestProvinceNetworth.kingdom)}</p>}<TiedLeaders labels={stats.provinceNetworthLeaders.map(row => row.province.name + ' (' + location(row.kingdom) + ')')} /></div>
    </article>
    <article className={styles.statCard}><h3>War ceasefires</h3><strong>{cfState === 'ready' ? number(stats.active.length) + ' active' : 'Unknown'}</strong><p>{cfState === 'ready' ? number(stats.endingSoon) + ' ending within 12 ticks \u00b7 estimated' : cfState === 'error' ? 'Ceasefire data unavailable' : 'Waiting for ceasefire data'}</p>{cfState === 'ready' && (stats.active[0] ? <p>Next: {kingdomLabel(stats.active[0].kingdom)} {'\u00b7'} ~{number(stats.active[0].ticks)} ticks</p> : <p>No active tracked war ceasefires</p>)}</article>
   </div>
   <details className={styles.moreStatistics}>
    <summary>More statistics <span>Race distribution & war records</span></summary>
    <div className={styles.moreStatisticsBody}>
     <article className={styles.statCard}><h3>Strongest war record</h3><strong>{stats.bestRate === null ? '\u2014' : number(stats.bestRate * 100) + '% win rate'}</strong><p>Minimum 3 concluded wars</p>{stats.leaders.length ? <ul className={styles.leaderList}>{stats.leaders.map(k => <li key={kingdomKey(k)}>{kingdomLabel(k)} {'\u00b7'} {k.warsWon}/{k.warsConcluded}</li>)}</ul> : <p>No qualifying kingdoms</p>}</article>
   {!!stats.raceTotal && <div className={styles.raceOverview}><h3>Race distribution <span>Listed provinces in matching kingdoms</span></h3><div className={styles.raceBars}>{stats.races.map(([race, count], index) => <div key={race}><div className={styles.raceLabel}><span>{race}</span><span>{number(count)} · {number(count / stats.raceTotal * 100)}%</span></div><div className={styles.barTrack}><div style={{ width: `${count / stats.raceTotal * 100}%`, background: `hsl(${190 + index * 23} 65% 60%)` }} /></div></div>)}</div></div>}
    </div>
   </details>
  </section>
  <section aria-label="Kingdom results">
   <div className={styles.sectionHeading}><div><h2>Kingdom results</h2><p className={styles.muted}>Click a column to cycle ascending, descending, then off. First selected column has highest priority.</p></div><button type="button" disabled={!sorts.length} onClick={() => setSorts([])}>Clear sorting</button></div>
   {!!sorts.length && <p className={styles.sortSummary}>Sort priority: {sorts.map((s, i) => `${i + 1}. ${columns.find(c => c.key === s.key)?.label} ${s.direction === 'ASC' ? '↑' : '↓'}`).join(' · ')}</p>}
   <p className={styles.muted}>War CF estimates may differ by 1–2 ticks because the game dump updates late. “No tracked war CF” does not indicate diplomatic relations or current war status.</p>
   <div className={styles.tableScroll} tabIndex={0} role="region" aria-label="Scrollable kingdom table"><table className={styles.kingdomsTable}>
    <thead><tr><th scope="col"><span className={styles.srOnly}>Province details</span></th>{columns.map(({ key, label }) => { const priority = sorts.findIndex(s => s.key === key); const sort = sorts[priority]; return <th scope="col" key={key} className={priority >= 0 ? styles.sortedColumn : ''} aria-sort={priority === 0 ? sort.direction === 'ASC' ? 'ascending' : 'descending' : priority > 0 ? 'other' : 'none'}><button type="button" onClick={() => sortBy(key)}>{label} {sort && <span>{sort.direction === 'ASC' ? '▲' : '▼'}<sup>{priority + 1}</sup></span>}</button></th>; })}</tr></thead>
    <tbody>{rows.map(k => { const key = kingdomKey(k), record = ceasefire[key], ticks = remainingTicks(record, now), end = record && data?.startDate ? expiryDate(record, data.startDate) : null; return <Fragment key={key}>
     <tr><td><button type="button" className={styles.expandButton} aria-expanded={expanded.has(key)} aria-controls={`provinces-${key}`} aria-label={`${expanded.has(key) ? 'Hide' : 'Show'} provinces for ${kingdomLabel(k)}`} onClick={() => toggle(key)}>{expanded.has(key) ? '−' : '+'}</button></td>
      <td className={styles.kingdomName}>{k.kingdomName || 'Unnamed kingdom'}</td><td>{location(k)}</td><td>{number(k.honor)}</td><td>{number(k.networth)}</td><td>{number(k.totalLand)}</td><td>{number(k.provinceCount)}</td><td>{number(k.warsConcluded)}</td><td>{number(k.warsWon)}</td><td>{number(k.warScore)}</td>
      <td>{cfState !== 'ready' ? <span className={styles.muted}>{cfState === 'error' ? 'CF unavailable' : 'Loading CF…'}</span> : ticks > 0 ? <><span className={ticks <= 12 ? styles.endingBadge : styles.cfBadge}>War CF · ~{number(ticks)} ticks</span><small className={styles.expiry}>{end ? `Ends ${end}` : 'End date unavailable'}</small></> : <span className={styles.muted}>No tracked war CF</span>}</td>
     </tr>
     {expanded.has(key) && <tr className={styles.expandedRow} id={`provinces-${key}`}><td colSpan={11}><ProvinceDetails kingdom={k} /></td></tr>}
    </Fragment>; })}</tbody>
   </table></div>
   {!rows.length && <div className={styles.emptyState}><h3>{cfFilter === 'CF_ONLY' && cfState !== 'ready' ? 'Ceasefire data unavailable' : 'No matching kingdoms'}</h3><p>Adjust your ranges or reset the filters to show all kingdoms.</p><button type="button" onClick={resetFilters}>Reset filters</button></div>}
  </section>
 </main>;
}
