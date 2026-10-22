'use client';

import { useMemo, useState } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Fields } from './KingdomView';
import { RecordTable, type RecordRow, type RecordColumn } from './RecordTable';
import { useLiveIntel } from './useLiveIntel';
import styles from './page.module.css';

export type Section = 'provinces' | 'recent' | 'archive' | 'war-plan' | 'history' | 'search' | 'reference';
export const sectionNames: Record<Section, string> = { provinces: 'Provinces', recent: 'Recent intel', archive: 'Province history', 'war-plan': 'War plans', history: 'Kingdom history', search: 'Kingdom search', reference: 'Reference data' };
type Envelope = { data: unknown; context: RecordRow; fetchedAt: string };
const rowsOf = (value: unknown): RecordRow[] => Array.isArray(value) ? value.filter((v): v is RecordRow => !!v && typeof v === 'object' && !Array.isArray(v)) : [];
const columns = (entries: [string, string][]): RecordColumn[] => entries.map(([key, label]) => ({ key, label }));
const fmt = (value: unknown) => typeof value === 'number' ? value.toLocaleString() : String(value ?? '—');

export function LoadingData() { return <div className={styles.loading} role="status"><div /><h2>Loading live intel</h2><p>Fetching the latest reports for your selection…</p></div>; }
export function FetchStatus({ time }: { time: string }) { return time ? <p className={styles.fetchStatus}>Fetched {new Date(time).toLocaleString()} · Live request</p> : null; }

function HistoryChart({ data }: { data: unknown }) {
  const [metric, setMetric] = useState('land');
  const series = data && typeof data === 'object' && !Array.isArray(data) ? Object.entries(data) : [];
  const chart = useMemo(() => {
    const ticks = new Map<number, RecordRow>();
    for (let index = 0; index < series.length; index++) {
      for (const row of rowsOf(series[index][1])) {
        if (typeof row.tickId !== 'number') continue;
        const entry = ticks.get(row.tickId) ?? { tickId: row.tickId };
        entry[`series${index}`] = row[metric]; ticks.set(row.tickId, entry);
      }
    }
    return [...ticks.values()].sort((a, b) => Number(a.tickId) - Number(b.tickId));
  // series is derived from the complete response; metric changes only the chart.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, metric]);
  if (!chart.length) return null;
  return <section className={styles.chartPanel}><div className={styles.panelHeading}><div><h3>Kingdom trends</h3><p>Last returned sample per tick. Every source record remains in the table below.</p></div><label>Measure<select value={metric} onChange={e => setMetric(e.target.value)}><option value="land">Land</option><option value="netWorth">Networth</option><option value="honor">Honor</option></select></label></div><div className={styles.chart}><ResponsiveContainer width="100%" height="100%"><LineChart data={chart} margin={{ top: 12, right: 24, left: 12, bottom: 8 }}><CartesianGrid stroke="#29394e" strokeDasharray="3 3" /><XAxis dataKey="tickId" stroke="#9cacc0" tick={{ fontSize: 11 }} label={{ value: 'Game tick', position: 'insideBottom', offset: -5, fill: '#9cacc0' }} /><YAxis stroke="#9cacc0" tick={{ fontSize: 11 }} width={75} tickFormatter={v => Number(v).toLocaleString()} /><Tooltip contentStyle={{ background: '#101e30', borderColor: '#35465d', color: '#e8eff8' }} labelFormatter={v => `Tick ${v}`} /><Legend />{series.map(([location], index) => <Line key={location} type="monotone" dataKey={`series${index}`} name={location} stroke={index === 0 ? '#80e2cb' : '#a5a0ff'} strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />)}</LineChart></ResponsiveContainer></div></section>;
}
function WarPlan({ value }: { value: unknown }) {
  const source = value && typeof value === 'object' ? value as RecordRow : null;
  if (!source) return <div className={styles.empty}><h3>No saved war plan</h3><p>No plan was returned for this kingdom.</p></div>;
  let plan: RecordRow | null = null;
  if (typeof source.json === 'string') {
    try { const parsed = JSON.parse(source.json); if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) plan = parsed; } catch { /* Keep the original response available below. */ }
  }
  if (!plan) return <Fields value={source} />;
  const groups = rowsOf(plan.columns);
  return <><div className={styles.planIntro}><h3>{String(plan.title || 'War plan')}</h3>{typeof plan.content === 'string' && <p>{plan.content}</p>}<span className={styles.status}>View only</span></div><div className={styles.planGrid}>{groups.map((group, index) => <section key={index} className={styles.planGroup}><h4>{String(group.title || `Group ${index + 1}`)} <span>{rowsOf(group.items).length}</span></h4>{rowsOf(group.items).map((item, i) => <article key={i}><Fields value={item} /></article>)}{!rowsOf(group.items).length && <p className={styles.muted}>No assigned provinces</p>}</section>)}</div><details className={styles.metadata}><summary>All saved plan fields</summary><Fields value={source} /><Fields value={plan} /></details></>;
}

export default function ResourcePanel({ section, server, location, side, revision, inspect }: { section: Exclude<Section, 'provinces'>; server: number; location: string; side: 'own' | 'enemy'; revision: number; inspect: (location: string) => void }) {
  const [slot, setSlot] = useState('1');
  const [length, setLength] = useState('72');
  const [startTick, setStartTick] = useState('');
  const [acres, setAcres] = useState('');
  const [networth, setNetworth] = useState('');
  const [provinceCount, setProvinceCount] = useState('');
  const [reference, setReference] = useState('races');
  const [applied, setApplied] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(0);
  const resource = section === 'reference' ? reference : section;
  const params = new URLSearchParams({ resource, server: String(server), location, side, ...applied });
  const url = `/api/intel-data?${params}`;
  const { data: envelope, loading, error, fetchedAt } = useLiveIntel<Envelope>(url, revision + submitted);
  const data = envelope?.data;
  const searchFilters = envelope?.context.filters as RecordRow | undefined;
  const inspectRow = (row: RecordRow) => { if (typeof row.location === 'string') inspect(row.location); };
  let tableRows: RecordRow[] = [], tableColumns: RecordColumn[] = [];
  if (section === 'recent') {
    tableRows = rowsOf(data).flatMap(k => rowsOf(k.provinces).map(p => ({ ...p, location: k.location, kingdomName: k.kingdomName })));
    tableColumns = columns([['location', 'Kingdom'], ['id', '#'], ['name', 'Province'], ['race', 'Race'], ['land', 'Acres'], ['networth', 'Networth'], ['sot.ageSeconds', 'Throne age (sec)']]);
  } else if (section === 'archive') {
    tableRows = rowsOf(data);
    tableColumns = columns([['tickName', 'Game date'], ['tickId', 'Tick'], ['land', 'Acres'], ['networth', 'Networth'], ['gold', 'Gold'], ['offPoints', 'Offense'], ['defPoints', 'Defense']]);
  } else if (section === 'history') {
    tableRows = data && typeof data === 'object' && !Array.isArray(data) ? Object.entries(data).flatMap(([loc, values]) => rowsOf(values).map(row => ({ ...row, location: loc }))) : [];
    tableColumns = columns([['location', 'Kingdom'], ['tickId', 'Tick'], ['land', 'Acres'], ['netWorth', 'Networth'], ['honor', 'Honor']]);
  } else if (section === 'search') {
    tableRows = rowsOf(data);
    tableColumns = columns([['location', 'Kingdom'], ['kingdomName', 'Name'], ['warStatus', 'Status'], ['warLocation', 'War opponent'], ['land', 'Acres'], ['netWorth', 'Networth'], ['provinces', 'Provinces'], ['honor', 'Honor']]);
  } else if (section === 'reference') {
    tableRows = rowsOf(data);
    tableColumns = reference === 'ticks' ? columns([['tickNumber', 'Tick'], ['tickName', 'Game date']]) : columns([['race', 'Race'], ['personality', 'Personality'], ['attrs.EliteName', 'Elite'], ['attrs.EliteOff', 'Elite offense'], ['attrs.EliteDef', 'Elite defense'], ['attrs.EliteCost', 'Elite cost']]);
  }
  return <section className={styles.resourceSection}>
    <div className={styles.sectionHeading}><h2>{sectionNames[section]}</h2><p>{section === 'recent' ? 'Recently available reports across kingdoms.' : section === 'archive' ? 'Archived throne reports for a province slot in the selected kingdom.' : section === 'war-plan' ? 'Existing saved plans for the selected kingdom.' : section === 'history' ? `Compare your kingdom with ${location} over game ticks.` : section === 'search' ? 'Find kingdoms near the selected size. Defaults use your own kingdom.' : 'Race attributes, personalities and game dates from the live service.'}</p></div>
    {section === 'archive' && <form className={styles.queryForm} onSubmit={e => { e.preventDefault(); setSubmitted(v => v + 1); setApplied({ slot }); }}><label>Province slot<input type="number" min="1" max="25" required value={slot} onChange={e => setSlot(e.target.value)} /></label><button className={styles.secondary}>Load province history</button>{envelope && <p>Showing {String(envelope.context.location)} · slot {String(envelope.context.slot)}</p>}</form>}
    {section === 'history' && <form className={styles.queryForm} onSubmit={e => { e.preventDefault(); setSubmitted(v => v + 1); setApplied({ numberTicks: length, ...(startTick ? { tickId: startTick } : {}) }); }}><label>History length (ticks)<input type="number" min="1" max="288" required value={length} onChange={e => setLength(e.target.value)} /></label><label>Start tick (optional)<input type="number" min="0" max="4000" placeholder="Latest available window" value={startTick} onChange={e => setStartTick(e.target.value)} /></label><button className={styles.secondary}>Load history</button>{envelope && <p>Start tick {fmt(envelope.context.tickId)} · {fmt(envelope.context.numberTicks)} ticks requested</p>}</form>}
    {section === 'search' && <form className={styles.queryForm} onSubmit={e => { e.preventDefault(); setSubmitted(v => v + 1); setApplied({ ...(acres ? { acres } : {}), ...(networth ? { networth } : {}), ...(provinceCount ? { provinces: provinceCount } : {}) }); }}><label>Target acres<input type="number" min="1" max="100000000" placeholder="Own kingdom" value={acres} onChange={e => setAcres(e.target.value)} /></label><label>Target networth<input type="number" min="1" max="1000000000000" placeholder="Own kingdom" value={networth} onChange={e => setNetworth(e.target.value)} /></label><label>Province count<input type="number" min="1" max="25" placeholder="Own kingdom" value={provinceCount} onChange={e => setProvinceCount(e.target.value)} /></label><button className={styles.secondary}>Search kingdoms</button>{searchFilters && <p>Searching near {fmt(searchFilters.acres)} acres · {fmt(searchFilters.networth)} NW · {fmt(searchFilters.provinces)} provinces. The service applies ±30% size and ±3 provinces.</p>}</form>}
    {section === 'reference' && <div className={styles.views} aria-label="Reference dataset"><button aria-pressed={reference === 'races'} onClick={() => setReference('races')}>Race & personality combinations</button><button aria-pressed={reference === 'ticks'} onClick={() => setReference('ticks')}>Game ticks</button></div>}
    <FetchStatus time={fetchedAt} />
    {loading ? <LoadingData /> : error ? <div className={styles.error} role="alert">{error}</div> : envelope && <>
      {section === 'war-plan' ? <WarPlan value={data} /> : <>{section === 'history' && <HistoryChart data={data} />}<RecordTable key={`${resource}-${server}-${location}-${side}-${JSON.stringify(applied)}`} title={sectionNames[section]} rows={tableRows} columns={tableColumns} onInspect={section === 'recent' || section === 'search' ? inspectRow : undefined} /></>}
      <details className={styles.metadata}><summary>Complete source response</summary><a href={url} target="_blank" rel="noreferrer">Open live JSON ↗</a><pre className={styles.rawJson} tabIndex={0}>{JSON.stringify(data, null, 2)}</pre></details>
    </>}
  </section>;
}
