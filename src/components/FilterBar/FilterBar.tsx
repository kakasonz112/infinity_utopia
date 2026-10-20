"use client";
import { useEffect, useState } from 'react';
import styles from "./FilterBar.module.css";
function NumberField({ value, max, id, label, onCommit }: { value: number; max: number; id: string; label: string; onCommit: (value: number) => void }) {
 const [draft, setDraft] = useState(String(value));
 useEffect(() => setDraft(String(value)), [value]);
 function commit() {
  const parsed = draft.trim() === '' ? NaN : Number(draft);
  if (!Number.isFinite(parsed)) { setDraft(String(value)); return; }
  const next = Math.min(max, Math.max(0, Math.round(parsed)));
  setDraft(String(next));
  onCommit(next);
 }
 return <input id={id} type="number" inputMode="numeric" aria-label={label} min={0} max={max} value={draft} onChange={event => setDraft(event.target.value)} onBlur={commit} onKeyDown={event => {
  if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); }
  if (event.key === 'Escape') { setDraft(String(value)); }
 }} />;
}
export type CfFilterType = "ALL" | "CF_ONLY";
export type Filters = { land: number[]; networth: number[]; provinces: number[] };
type Props = { filters: Filters; cfFilter: CfFilterType; onFilterChange: (filters: Filters) => void; onCfFilterChange: (value: CfFilterType) => void; biggestLand: number; biggestNetworth: number; onReset: () => void; cfAvailable: boolean };
export default function FilterBar({ filters, cfFilter, onFilterChange, onCfFilterChange, biggestLand, biggestNetworth, onReset, cfAvailable }: Props) {
 const ranges = [
  { key: "land" as const, label: "Land (acres)", max: Math.max(100, filters.land[1], Math.ceil(biggestLand / 100) * 100), step: 100 },
  { key: "networth" as const, label: "Networth", max: Math.max(50000, filters.networth[1], Math.ceil(biggestNetworth / 50000) * 50000), step: 50000 },
  { key: "provinces" as const, label: "Province count", max: 25, step: 1 },
 ];
 function change(key: keyof Filters, index: number, value: number, max: number) {
  if (!Number.isFinite(value)) return;
  const next = [...filters[key]];
  next[index] = Math.min(max, Math.max(0, Math.round(value)));
  if (index === 0) next[1] = Math.max(next[0], next[1]); else next[0] = Math.min(next[0], next[1]);
  onFilterChange({ ...filters, [key]: next });
 }
 return <section className={styles.filterBar} aria-label="Kingdom filters">
  <div className={styles.filterHeader}><h2 className={styles.filterTitle}>Filters</h2><button type="button" onClick={onReset}>Reset filters</button></div>
  <div className={styles.cfSection}><span className={styles.cfLabel}>War ceasefire</span>
   {([['ALL', 'All kingdoms'], ['CF_ONLY', 'Tracked war CF only']] as const).map(([value, label]) => <label className={styles.cfOption} key={value}><input type="radio" name="cfFilter" checked={cfFilter === value} disabled={value === 'CF_ONLY' && !cfAvailable} onChange={() => onCfFilterChange(value)} />{label}</label>)}
  </div>
  {ranges.map(({ key, label, max, step }) => <fieldset className={styles.rangeGroup} key={key}>
   <legend className={styles.rangeTitle}>{label}</legend>
   {['Min', 'Max'].map((bound, index) => <div className={styles.sliderLine} key={bound}>
    <label htmlFor={`${key}-${bound}`}>{bound}</label>
    <NumberField id={`${key}-${bound}`} label={`${label} ${bound}`} max={max} value={filters[key][index]} onCommit={value => change(key, index, value, max)} />
    <input aria-label={`${label} ${bound} slider`} type="range" min={0} max={max} step={step} value={filters[key][index]} onChange={e => change(key, index, +e.target.value, max)} className={styles.rangeInput} />
   </div>)}
  </fieldset>)}
 </section>;
}
