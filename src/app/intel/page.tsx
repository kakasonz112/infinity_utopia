'use client';

import { useEffect, useState } from 'react';
import ProvinceWorkspace from './ProvinceWorkspace';
import ResourcePanel, { LoadingData, sectionNames, type Section } from './ResourcePanel';
import styles from './page.module.css';

type Side = 'own' | 'enemy';
export default function IntelPage() {
  const [section, setSection] = useState<Section>('provinces');
  const server = 1;
  const [side, setSide] = useState<Side>('own');
  const [location, setLocation] = useState('5:11');
  const [kingdom, setKingdom] = useState('5');
  const [island, setIsland] = useState('11');
  const [revision, setRevision] = useState(0);
  const [ready, setReady] = useState(false);
  const [splitView, setSplitView] = useState(false);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const part = q.get('section');
    if (part && Object.hasOwn(sectionNames, part)) setSection(part as Section);
    if (q.get('side') === 'enemy') setSide('enemy');
    setSplitView(q.get('split') === '1');
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
    const q = new URLSearchParams({ section, server: String(server), side, location, ...(splitView ? { split: '1' } : {}) });
    window.history.replaceState(null, '', `${window.location.pathname}?${q}`);
  }, [ready, section, server, side, location, splitView]);
  function inspect(target: string) {
    if (!/^[1-9]\d{0,2}:[1-9]\d{0,2}$/.test(target)) return;
    const [k, i] = target.split(':'); setKingdom(k); setIsland(i); setLocation(target); setSide('enemy'); setSection('provinces'); setRevision(v => v + 1);
  }
  const hasSide = ['provinces', 'archive', 'war-plan'].includes(section);
  const splitActive = splitView && hasSide;
  const renderSide = (target: Side) => <ResourcePanel key={`${section}-${server}-${location}-${target}`} section={section as Exclude<Section, 'provinces'>} server={server} location={location} side={target} revision={revision} inspect={inspect} />;
  return <main className={styles.page} data-split={splitActive ? 'true' : undefined}>
    <header className={styles.heading}><div><p className={styles.eyebrow}>Infinity / Intelligence</p><h1>Kingdom intelligence<span>.</span></h1><p>Live province reports, kingdom history and planning data in one place.</p></div><button className={styles.primary} onClick={() => setRevision(v => v + 1)} disabled={!ready}>↻ Refresh section</button></header>
    <section className={styles.targetBar} aria-label="Intel settings">
      <div className={styles.serverLabel}><span>Game server</span><strong>World of Legends</strong></div>
      <form className={styles.targetForm} onSubmit={e => { e.preventDefault(); const target = `${Number(kingdom)}:${Number(island)}`; setLocation(target); if (hasSide) setSide('enemy'); setRevision(v => v + 1); }}>
        <label>Enemy kingdom<input type="number" min="1" max="999" step="1" required value={kingdom} onChange={e => setKingdom(e.target.value)} /></label><span className={styles.separator}>:</span><label>Island<input type="number" min="1" max="999" step="1" required value={island} onChange={e => setIsland(e.target.value)} /></label><button className={styles.secondary}>Load intel →</button>
      </form><p className={styles.activeTarget}>Selected enemy <strong>{location}</strong></p>
    </section>
    <nav className={styles.sectionNav} aria-label="Intel sections">{(Object.keys(sectionNames) as Section[]).map(name => <button key={name} aria-current={section === name ? 'page' : undefined} onClick={() => { setSection(name); setRevision(v => v + 1); }}>{sectionNames[name]}</button>)}</nav>
    {hasSide && <div className={styles.toolbar}>{!splitActive && <div className={styles.kingdomSwitch} aria-label="Select kingdom">{(['own', 'enemy'] as const).map(s => <button key={s} aria-pressed={side === s} onClick={() => { setSide(s); setRevision(v => v + 1); }}>{s === 'own' ? 'Own kingdom' : 'Enemy kingdom'}<span>{s === 'own' ? 'Account' : location}</span></button>)}</div>}<label className={styles.splitToggle}><input type="checkbox" checked={splitView} onChange={e => { setSplitView(e.target.checked); setRevision(v => v + 1); }} /><span>Split view <small>50 / 50 · Own + enemy</small></span></label><p>{splitActive ? 'Each pane has independent filters and scrolling' : 'Fresh data on every visit and refresh'}</p></div>}
    <div aria-busy={!ready}>{!ready ? <LoadingData /> : section === 'provinces' ? <ProvinceWorkspace server={server} location={location} side={side} revision={revision} split={splitActive} /> : splitActive ? <div className={styles.splitGrid}>{(['own', 'enemy'] as const).map(target => <section key={target} className={styles.splitPane} aria-label={target === 'own' ? 'Own kingdom pane' : 'Enemy kingdom pane'}><div className={styles.paneHeading}>{target === 'own' ? 'Own kingdom' : `Enemy kingdom · ${location}`}</div>{renderSide(target)}</section>)}</div> : renderSide(side)}</div>
    <p className={styles.footnote}>Reports are fetched live when you open a section or refresh. Intel age reflects when the report was collected in game; a live fetch does not create new game intel.</p>
  </main>;
}
