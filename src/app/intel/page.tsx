'use client';

import { useEffect, useState } from 'react';
import type { IntelResponse } from '@/lib/utopiaIntel';
import Kingdom from './KingdomView';
import ResourcePanel, { FetchStatus, LoadingData, sectionNames, type Section } from './ResourcePanel';
import { useLiveIntel } from './useLiveIntel';
import styles from './page.module.css';

type Side = 'own' | 'enemy';
function ProvincePanel({ server, location, side, revision }: { server: number; location: string; side: Side; revision: number }) {
  const query = new URLSearchParams({ server: String(server), location, side });
  const { data, error, loading, fetchedAt } = useLiveIntel<IntelResponse>(`/api/kingdom-intel?${query}`, revision);
  return <><FetchStatus time={fetchedAt} />{loading ? <LoadingData /> : error ? <p className={styles.error} role="alert">{error}</p> : data && <Kingdom key={`${server}-${side}-${location}`} result={{ kingdom: data.kingdom, response: data, error: null }} server={server} location={location} side={side} />}</>;
}

export default function IntelPage() {
  const [section, setSection] = useState<Section>('provinces');
  const server = 1;
  const [side, setSide] = useState<Side>('own');
  const [location, setLocation] = useState('5:11');
  const [kingdom, setKingdom] = useState('5');
  const [island, setIsland] = useState('11');
  const [revision, setRevision] = useState(0);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const part = q.get('section');
    if (part && Object.hasOwn(sectionNames, part)) setSection(part as Section);
    if (q.get('side') === 'enemy') setSide('enemy');
    const target = q.get('location');
    if (target && /^[1-9]\d{0,2}:[1-9]\d{0,2}$/.test(target)) {
      setLocation(target); const [k, i] = target.split(':'); setKingdom(k); setIsland(i);
    }
    setReady(true);
    const onPageShow = (event: PageTransitionEvent) => { if (event.persisted) setRevision(v => v + 1); };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);
  useEffect(() => {
    if (!ready) return;
    const q = new URLSearchParams({ section, server: String(server), side, location });
    window.history.replaceState(null, '', `${window.location.pathname}?${q}`);
  }, [ready, section, server, side, location]);
  function inspect(target: string) {
    if (!/^[1-9]\d{0,2}:[1-9]\d{0,2}$/.test(target)) return;
    const [k, i] = target.split(':'); setKingdom(k); setIsland(i); setLocation(target); setSide('enemy'); setSection('provinces'); setRevision(v => v + 1);
  }
  const hasSide = ['provinces', 'archive', 'war-plan'].includes(section);
  return <main className={styles.page}>
    <header className={styles.heading}><div><p className={styles.eyebrow}>Infinity / Intelligence</p><h1>Kingdom intelligence<span>.</span></h1><p>Live province reports, kingdom history and planning data in one place.</p></div><button className={styles.primary} onClick={() => setRevision(v => v + 1)} disabled={!ready}>↻ Refresh section</button></header>
    <section className={styles.targetBar} aria-label="Intel settings">
      <div className={styles.serverLabel}><span>Game server</span><strong>World of Legends</strong></div>
      <form className={styles.targetForm} onSubmit={e => { e.preventDefault(); const target = `${Number(kingdom)}:${Number(island)}`; setLocation(target); if (hasSide) setSide('enemy'); setRevision(v => v + 1); }}>
        <label>Enemy kingdom<input type="number" min="1" max="999" step="1" required value={kingdom} onChange={e => setKingdom(e.target.value)} /></label><span className={styles.separator}>:</span><label>Island<input type="number" min="1" max="999" step="1" required value={island} onChange={e => setIsland(e.target.value)} /></label><button className={styles.secondary}>Load intel →</button>
      </form><p className={styles.activeTarget}>Selected enemy <strong>{location}</strong></p>
    </section>
    <nav className={styles.sectionNav} aria-label="Intel sections">{(Object.keys(sectionNames) as Section[]).map(name => <button key={name} aria-current={section === name ? 'page' : undefined} onClick={() => { setSection(name); setRevision(v => v + 1); }}>{sectionNames[name]}</button>)}</nav>
    {hasSide && <div className={styles.toolbar}><div className={styles.kingdomSwitch} aria-label="Select kingdom">{(['own', 'enemy'] as const).map(s => <button key={s} aria-pressed={side === s} onClick={() => { setSide(s); setRevision(v => v + 1); }}>{s === 'own' ? 'Own kingdom' : 'Enemy kingdom'}<span>{s === 'own' ? 'Account' : location}</span></button>)}</div><p>Fresh data on every visit and refresh</p></div>}
    <div aria-busy={!ready}>{ready ? section === 'provinces' ? <ProvincePanel server={server} location={location} side={side} revision={revision} /> : <ResourcePanel key={`${section}-${server}-${location}-${side}`} section={section} server={server} location={location} side={side} revision={revision} inspect={inspect} /> : <LoadingData />}</div>
    <p className={styles.footnote}>Reports are fetched live when you open a section or refresh. Intel age reflects when the report was collected in game; a live fetch does not create new game intel.</p>
  </main>;
}
