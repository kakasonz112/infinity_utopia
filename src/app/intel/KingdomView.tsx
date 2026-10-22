'use client';

import { Fragment, useMemo, useState } from 'react';
import type { IntelKingdom, IntelProvince, IntelResponse } from '@/lib/utopiaIntel';
import styles from './page.module.css';
import DragScroll from './DragScroll';

export type Result = { kingdom: IntelKingdom | null; response: IntelResponse | null; error: string | null };
type Column = { key: string; label: string; unit?: string; value?: (p: IntelProvince) => unknown };
const views: Record<string, Column[]> = {
  Overview: [{ key: 'race', label: 'Race' }, { key: 'sot.personality', label: 'Personality' }, { key: 'land', label: 'Land', unit: 'acres' }, { key: 'networth', label: 'Networth', unit: 'gc' }, { key: 'nwpa', label: 'NW / acre' }, { key: 'sot.ageSeconds', label: 'Throne intel', unit: 'age' }],
  Military: [{ key: 'sot.offPoints', label: 'Offense' }, { key: 'calcs.defPointsSummary.defPointsHome', label: 'Defense home' }, { key: 'sot.opa', label: 'Off / acre' }, { key: 'sot.dpa', label: 'Def / acre' }, { key: 'sot.elites', label: 'Elites' }, { key: 'som.ageSeconds', label: 'Military intel', unit: 'age' }],
  Economy: [{ key: 'sot.money', label: 'Gold', unit: 'gc' }, { key: 'sot.food', label: 'Food' }, { key: 'sot.runes', label: 'Runes' }, { key: 'sot.peasants', label: 'Peasants' }, { key: 'sot.be', label: 'Building eff.', unit: '%' }, { key: 'sot.tb', label: 'Trade balance' }],
  'Thievery & magic': [{ key: 'sot.thieves', label: 'Thieves' }, { key: 'sot.tpa', label: 'Raw TPA' }, { key: 'sot.stealth', label: 'Stealth', unit: '%' }, { key: 'sot.wizards', label: 'Wizards' }, { key: 'sot.wpa', label: 'Raw WPA' }, { key: 'sot.mana', label: 'Mana', unit: '%' }],
  Army: [{ key: 'som.standingArmy.generals', label: 'Generals home' }, { key: 'som.standingArmy.solds', label: 'Soldiers home' }, { key: 'som.standingArmy.oSpecs', label: 'Off. specs home' }, { key: 'som.standingArmy.elites', label: 'Elites home' }, { key: 'som.standingArmy.horses', label: 'Horses home' }, { key: 'awayCount', label: 'Armies away', value: p => Array.isArray(get(p, 'som.armiesAway')) ? (get(p, 'som.armiesAway') as unknown[]).length : null }, { key: 'nextReturn', label: 'Next return', unit: 'duration', value: p => { const times = records(get(p, 'som.armiesAway')).map(a => a.secondsRemaining).filter((n): n is number => typeof n === 'number'); return times.length ? Math.min(...times) : null; } }, { key: 'som.training.totalTraining', label: 'In training' }, { key: 'som.ageSeconds', label: 'Military intel', unit: 'age' }],
  Spells: [{ key: 'sot.goodSpells', label: 'Beneficial spells', unit: 'spells' }, { key: 'sot.badSpells', label: 'Harmful spells', unit: 'spells' }, { key: 'sot.cooldown', label: 'Cooldowns', unit: 'spells' }, { key: 'sot.mana', label: 'Mana', unit: '%' }, { key: 'sot.ageSeconds', label: 'Throne intel', unit: 'age' }],
  Survey: [],
  Science: [],
};
const records = (value: unknown): Record<string, unknown>[] => Array.isArray(value) ? value.filter((v): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v)) : [];
const cellValue = (p: IntelProvince, c: Column) => c.value ? c.value(p) : get(p, c.key);
const sortValue = (value: unknown) => Array.isArray(value) ? value.map(v => v && typeof v === 'object' ? `${fmt(v.name)} ${fmt(v.ticks)}` : fmt(v)).join(', ') : value;
const duration = (seconds: unknown) => typeof seconds !== 'number' ? '—' : `${Math.floor(Math.max(0, seconds) / 3600)}h ${Math.floor(Math.max(0, seconds) % 3600 / 60)}m`;
function SpellList({ value }: { value: unknown }) {
  if (!Array.isArray(value)) return <span className={styles.muted}>{value == null ? 'No intel' : fmt(value)}</span>;
  if (!value.length) return <span className={styles.muted}>None</span>;
  return <div className={styles.spellList}>{value.map((spell, i) => {
    if (!spell || typeof spell !== 'object') return <span key={i}>{fmt(spell)}</span>;
    return <span key={i}>{fmt(spell.name)}{typeof spell.ticks === 'number' ? <small>{spell.ticks} ticks</small> : <Fields value={Object.fromEntries(Object.entries(spell).filter(([key]) => key !== 'name'))} />}</span>;
  })}</div>;
}
const labels: Record<string, string> = { sot: 'Throne intel', som: 'Military intel', sos: 'Science intel', survey: 'Buildings & survey', ma: 'Military administration', calcs: 'Calculated values', kdEffects: 'Kingdom effects', nwpa: 'Networth per acre', ageSeconds: 'Intel age (seconds)', oSpecs: 'Offensive specialists', dSpecs: 'Defensive specialists', tpa: 'Thieves per acre', wpa: 'Wizards per acre', be: 'Building efficiency', opa: 'Offense per acre', dpa: 'Defense per acre' };
const label = (key: string) => labels[key] || key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, c => c.toUpperCase());
function get(value: unknown, path: string): unknown { return path.split('.').reduce<unknown>((v, key) => v && typeof v === 'object' ? (v as Record<string, unknown>)[key] : undefined, value); }
const fmt = (v: unknown): string => v == null || v === '' ? '—' : typeof v === 'number' ? v.toLocaleString('en-US', { maximumFractionDigits: 2 }) : typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v);
const age = (v: unknown) => typeof v !== 'number' ? 'No intel' : v < 60 ? '<1m' : v < 3600 ? `${Math.floor(v / 60)}m` : `${Math.floor(v / 3600)}h ${Math.floor(v % 3600 / 60)}m`;
export function Fields({ value }: { value: unknown }) {
  if (value == null || value === '') return <span className={styles.muted}>Not available</span>;
  if (Array.isArray(value)) {
    if (!value.length) return <span className={styles.muted}>None</span>;
    if (value.every(v => v && typeof v === 'object' && !Array.isArray(v))) {
      const keys = Array.from(new Set(value.flatMap(v => Object.keys(v))));
      return <DragScroll><table className={styles.detailTable}><thead><tr>{keys.map(k => <th key={k} scope="col">{label(k)}</th>)}</tr></thead><tbody>{value.map((v, i) => <tr key={i}>{keys.map(k => <td key={k}><Fields value={v[k]} /></td>)}</tr>)}</tbody></table></DragScroll>;
    }
    return <div>{value.map((v, i) => <div key={i}><Fields value={v} /></div>)}</div>;
  }
  if (typeof value === 'object') return <dl className={styles.fields}>{Object.entries(value).map(([k, v]) => <div key={k}><dt>{label(k)}</dt><dd><Fields value={v} /></dd></div>)}</dl>;
  return <>{fmt(value)}</>;
}
function ProvinceDetails({ province, view }: { province: IntelProvince; view: string }) {
  const focus: Record<string, string> = { Army: 'som', Spells: 'sot', Survey: 'survey', Science: 'sos' };
  const sections = Object.entries(province).filter(([key, v]) => v !== null && typeof v === 'object' && (!focus[view] || key === focus[view]));
  const basic = Object.fromEntries(Object.entries(province).filter(([, v]) => v === null || typeof v !== 'object'));
  return <div className={styles.detailContent}><p className={styles.eyebrow}>{focus[view] ? `${view} details` : 'Complete province intel'}</p><h3>#{province.id} {province.name}</h3><div className={styles.detailGrid}><section><h4>Province profile</h4><Fields value={basic} /></section>{sections.map(([key, value]) => <section key={key}><h4>{label(key)}</h4><Fields value={value} /></section>)}</div></div>;
}
export default function Kingdom({ result, side, server = 1, location = '5:11' }: { result: Result; side: 'own' | 'enemy'; server?: number; location?: string }) {
  const [search, setSearch] = useState('');
  const [race, setRace] = useState('');
  const [personality, setPersonality] = useState('');
  const [freshness, setFreshness] = useState('');
  const [minLand, setMinLand] = useState('');
  const [maxLand, setMaxLand] = useState('');
  const [view, setView] = useState('Overview');
  const [sort, setSort] = useState({ key: 'name', descending: false });
  const [expanded, setExpanded] = useState<number | null>(null);
  const [surveyMetric, setSurveyMetric] = useState('pctCurr');
  const k = result.kingdom;
  const provinces = useMemo(() => k?.provinces ?? [], [k]);
  const options = (path: string) => Array.from(new Set(provinces.map(p => get(p, path)).filter((v): v is string => typeof v === 'string' && !!v))).sort();
  const columns = useMemo<Column[]>(() => {
    if (view === 'Survey') {
      const names = Array.from(new Set(provinces.flatMap(p => records(get(p, 'survey.buildings')).map(b => b.name)).filter((n): n is string => typeof n === 'string'))).sort();
      return [{ key: 'survey.buildingEff', label: 'Building efficiency', unit: '%', value: p => typeof get(p, 'survey.buildingEff') === 'number' ? (get(p, 'survey.buildingEff') as number) * 100 : null }, { key: 'survey.availableWorkers', label: 'Workers' }, { key: 'survey.ageSeconds', label: 'Survey intel', unit: 'age' }, ...names.map(name => ({ key: `building:${name}`, label: name, unit: '%', value: (p: IntelProvince) => records(get(p, 'survey.buildings')).find(b => b.name === name)?.[surveyMetric] }))];
    }
    if (view === 'Science') {
      const types = Array.from(new Set(provinces.flatMap(p => records(get(p, 'sos.books')).map(b => b.type)).filter((n): n is string => typeof n === 'string'))).sort();
      return [{ key: 'sos.allocatedBooks', label: 'Allocated books' }, { key: 'sos.unallocatedBooks', label: 'Unallocated books' }, { key: 'sos.ageSeconds', label: 'Science intel', unit: 'age' }, ...types.map(type => ({ key: `science:${type}`, label: type, unit: '%', value: (p: IntelProvince) => records(get(p, 'sos.books')).find(b => b.type === type)?.effect }))];
    }
    return views[view];
  }, [view, provinces, surveyMetric]);
  const filtered = useMemo(() => provinces.filter(p => {
    const seconds = get(p, 'sot.ageSeconds');
    return (!search || [p.name, p.id, p.race, get(p, 'sot.ruler'), p.discord].some(v => String(v ?? '').toLowerCase().includes(search.toLowerCase())))
      && (!race || p.race === race) && (!personality || get(p, 'sot.personality') === personality)
      && (!minLand || typeof p.land === 'number' && p.land >= Number(minLand))
      && (!maxLand || typeof p.land === 'number' && p.land <= Number(maxLand))
      && (!freshness || (freshness === 'missing' ? typeof seconds !== 'number' : typeof seconds === 'number' && (freshness === 'fresh' ? seconds < 3600 : seconds >= 3600)));
  }).sort((a, b) => {
    const column = columns.find(c => c.key === sort.key);
    const x = sortValue(column ? cellValue(a, column) : get(a, sort.key)), y = sortValue(column ? cellValue(b, column) : get(b, sort.key));
    if (x == null || x === '') return y == null || y === '' ? 0 : 1;
    if (y == null || y === '') return -1;
    const comparison = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true });
    return sort.descending ? -comparison : comparison;
  }), [provinces, search, race, personality, minLand, maxLand, freshness, sort, columns]);
  const activeFilters = !!(search || race || personality || freshness || minLand || maxLand);
  function reset() { setSearch(''); setRace(''); setPersonality(''); setFreshness(''); setMinLand(''); setMaxLand(''); }
  function exportCsv() {
    const keys: Column[] = [{ key: 'id', label: '#' }, { key: 'name', label: 'Province' }, ...columns];
    const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""').replace(/^[=+@\t\r]/, "'$&")}"`;
    const csv = [keys.map(c => escape(c.label)).join(','), ...filtered.map(p => keys.map(c => { const value = cellValue(p, c); return escape(value !== null && typeof value === 'object' ? JSON.stringify(value) : value); }).join(','))].join('\r\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = `kingdom-${k?.location.replace(':', '-')}-${view}.csv`; a.click(); URL.revokeObjectURL(url);
  }
  if (!k) return <div className={styles.error} role="alert">{result.error}</div>;
  const sum = (key: string) => provinces.reduce((total, p) => total + (typeof get(p, key) === 'number' ? get(p, key) as number : 0), 0);
  return <>
    <section className={styles.kingdomHeader}><div><p className={styles.eyebrow}>{side === 'own' ? 'Your kingdom' : 'Enemy kingdom'} / {k.location}</p><h2>{k.kingdomName || 'Unnamed kingdom'}</h2><span className={styles.status}>{k.war ? 'At war' : k.eowcf ? 'End-of-war ceasefire' : 'No active war'}</span></div><div className={styles.effects}><Fields value={k.kdEffects} /></div></section>
    <div className={styles.stats}>{[['Provinces', provinces.length, 'in this kingdom'], ['Total land', sum('land'), 'acres'], ['Total networth', sum('networth'), 'gold coins'], ['Fresh throne intel', provinces.filter(p => typeof get(p, 'sot.ageSeconds') === 'number' && (get(p, 'sot.ageSeconds') as number) < 3600).length, 'less than 1 hour old']].map(([title, value, note]) => <div key={title}><span>{title}</span><strong>{fmt(value)}</strong><small>{note}</small></div>)}</div>
    <section className={styles.panel} aria-label="Province explorer"><div className={styles.panelHeading}><div><h3>Province explorer</h3><p>Select a view, sort a column, or open a province for complete intel.</p></div><button className={styles.secondary} onClick={exportCsv}>Export filtered CSV ↓</button></div>
      <div className={styles.views} aria-label="Table view">{Object.keys(views).map(name => <button key={name} aria-pressed={view === name} onClick={() => { setView(name); setSort({ key: 'name', descending: false }); }}>{name}</button>)}</div>
      {view === 'Survey' && <div className={styles.surveyControls}><label>Building percentages<select value={surveyMetric} onChange={e => setSurveyMetric(e.target.value)}><option value="pctCurr">Current buildings</option><option value="pctInc">Incoming construction</option><option value="pctTot">Total incl. construction</option></select></label></div>}
      {['Army', 'Spells', 'Survey', 'Science'].includes(view) && <p className={styles.viewHint}>{view === 'Army' ? 'Troops at home, armies away and the next return time. Expand a province for each army, training and military modifiers.' : view === 'Spells' ? 'Spell durations are shown in game ticks. Expand a province for the complete throne report.' : view === 'Survey' ? 'Each building has a sortable percentage column. Expand a province for current, incoming and total construction side by side.' : 'Each science category shows its reported effect percentage. Expand a province for the complete science report.'}</p>}
      <div className={styles.filters}>
        <label className={styles.search}>Search provinces<input type="search" placeholder="Name, ruler, race, slot or Discord…" value={search} onChange={e => setSearch(e.target.value)} /></label>
        <label>Race<select value={race} onChange={e => setRace(e.target.value)}><option value="">All races</option>{options('race').map(v => <option key={v}>{v}</option>)}</select></label>
        <label>Personality<select value={personality} onChange={e => setPersonality(e.target.value)}><option value="">All personalities</option>{options('sot.personality').map(v => <option key={v}>{v}</option>)}</select></label>
        <label>Throne intel<select value={freshness} onChange={e => setFreshness(e.target.value)}><option value="">Any age</option><option value="fresh">Under 1 hour</option><option value="old">1 hour or older</option><option value="missing">Missing intel</option></select></label>
        <label>Min. acres<input type="number" min="0" value={minLand} onChange={e => setMinLand(e.target.value)} placeholder="Any" /></label><label>Max. acres<input type="number" min="0" value={maxLand} onChange={e => setMaxLand(e.target.value)} placeholder="Any" /></label>
      </div>
      <div className={styles.results}><span aria-live="polite">Showing <b>{filtered.length}</b> of {provinces.length} provinces{activeFilters ? ' · Filters applied' : ''}</span>{activeFilters && <button onClick={reset}>Clear filters</button>}<span>— = unavailable intel</span></div>
      <DragScroll tabIndex={0} role="region" aria-label={`${view} province table`}><table className={styles.provinceTable}><caption className={styles.srOnly}>{k.kingdomName || 'Unnamed kingdom'} · {view}. Click a column heading to sort.</caption><thead><tr>{([{ key: 'id', label: '#' }, { key: 'name', label: 'Province' }, ...columns] as Column[]).map(c => <th key={c.key} scope="col" aria-sort={sort.key === c.key ? sort.descending ? 'descending' : 'ascending' : 'none'}><button onClick={() => setSort({ key: c.key, descending: sort.key === c.key ? !sort.descending : false })}>{c.label}<span aria-hidden="true">{sort.key === c.key ? sort.descending ? ' ↓' : ' ↑' : ' ↕'}</span>{c.unit && <small>{c.unit === 'age' ? 'age at fetch' : c.unit}</small>}</button></th>)}</tr></thead><tbody>{filtered.map(p => <Fragment key={p.id}><tr className={expanded === p.id ? styles.selected : ''}><td className={styles.idCell}>{p.id}</td><th scope="row"><button className={styles.provinceButton} aria-expanded={expanded === p.id} aria-controls={`province-${side}-${p.id}`} onClick={() => setExpanded(expanded === p.id ? null : p.id)}><span>{p.name}<small>{fmt(p.title)}</small></span><span aria-hidden="true">{expanded === p.id ? '−' : '+'}</span></button></th>{columns.map(c => <td key={c.key} className={typeof cellValue(p, c) === 'number' ? styles.numeric : ''}>{c.unit === 'spells' ? <SpellList value={cellValue(p, c)} /> : c.unit === 'duration' ? duration(cellValue(p, c)) : c.unit === 'age' ? <span className={typeof cellValue(p, c) !== 'number' ? styles.muted : (cellValue(p, c) as number) < 3600 ? styles.fresh : styles.stale}>{age(cellValue(p, c))}</span> : fmt(cellValue(p, c))}{c.unit === '%' && typeof cellValue(p, c) === 'number' ? '%' : ''}</td>)}</tr><tr hidden={expanded !== p.id} id={`province-${side}-${p.id}`}><td colSpan={columns.length + 2}>{expanded === p.id && <ProvinceDetails province={p} view={view} />}</td></tr></Fragment>)}</tbody></table></DragScroll>
      {!filtered.length && <div className={styles.empty}><h3>No provinces match</h3><p>Try a broader search or clear your filters.</p><button className={styles.secondary} onClick={reset}>Clear filters</button></div>}
    </section>
    <details className={styles.metadata}><summary>Kingdom metadata & full response</summary><Fields value={Object.fromEntries(Object.entries(result.response ?? {}).filter(([key]) => key !== 'kingdom'))} /><Fields value={Object.fromEntries(Object.entries(k).filter(([key]) => key !== 'provinces'))} /><a href={`/api/kingdom-intel?side=${side}&server=${server}&location=${encodeURIComponent(location)}`} target="_blank" rel="noreferrer">Open complete JSON ↗</a></details>
  </>;
}
