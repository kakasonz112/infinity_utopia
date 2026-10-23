'use client';

import { useMemo, useState } from 'react';
import type { IntelKingdom, IntelProvince } from '@/lib/utopiaIntel';
import { compact, defenseHome, field, numeric, relative, returnLabel, returnPoints, type ArmyPoint } from './combatModel';
import styles from './page.module.css';

export function ArmySummary({ province }: { province: IntelProvince }) {
  const armies = field(province, 'som.armiesAway');
  if (!Array.isArray(armies)) return <span>{String(field(province, 'sot.army') || '—')}</span>;
  if (!armies.length) return <span className={styles.muted}>No armies away</span>;
  return <span className={styles.returnSummary}>{armies.map((army, i) => <span key={i}>{i > 0 && <span className={styles.armyPipe}> | </span>}<span className={styles.returnTime}>{numeric(army?.secondsRemaining) === null ? '—' : returnLabel(army.secondsRemaining / 3600)}</span><span className={styles.incomingLand}>({numeric(army?.land) === null ? '—' : army.land.toLocaleString()}a)</span></span>)}</span>;
}
function Power({ attack, defense, title, tone }: { attack: number | null; defense: number | null; title: string; tone: 'own' | 'enemy' }) {
  const ratio = relative(attack, defense);
  return <section className={styles.powerCard} data-side={tone}><h4>{title}</h4><div><strong>{compact(attack)}</strong><span>offense vs</span><strong>{compact(defense)}</strong><span>defense home</span></div><p>{ratio === null ? defense === 0 ? 'No positive defense reported; ratio unavailable.' : 'Comparison unavailable — missing intel.' : <><b>{(ratio * 100).toFixed(1)}%</b> of reported defense home · <b>{ratio.toFixed(2)}×</b></>}</p><div className={styles.powerTrack} aria-hidden="true"><span style={{ width: `${ratio === null ? 0 : Math.min(100, ratio * 100)}%` }} /></div></section>;
}
function ProvinceCard({ p, side }: { p?: IntelProvince; side: 'own' | 'enemy' }) {
  if (!p) return <p>No province data available.</p>;
  const armyList = field(p, 'som.armiesAway');
  const incoming = Array.isArray(armyList) ? armyList.map(a => numeric(a?.land)).filter((v): v is number => v !== null) : [];
  const age = numeric(field(p, 'som.ageSeconds'));
  return <div className={styles.faceProvince} data-side={side}><h4>#{p.id} {p.name}</h4><dl><div><dt>Networth</dt><dd>{compact(p.networth)}</dd></div><div><dt>Offense / OPA</dt><dd>{compact(field(p, 'sot.offPoints'))} / {String(field(p, 'sot.opa') ?? '—')}</dd></div><div><dt>Defense / DPA</dt><dd>{compact(field(p, 'sot.defPoints'))} / {String(field(p, 'sot.dpa') ?? '—')}</dd></div><div><dt>Offense home</dt><dd>{compact(field(p, 'som.offPointsHome'))}</dd></div><div><dt>Defense home</dt><dd>{compact(defenseHome(p))}</dd></div><div><dt>Incoming acres</dt><dd className={styles.incomingLand}>{Array.isArray(armyList) && (armyList.length === 0 || incoming.length > 0) ? incoming.reduce((a, b) => a + b, 0).toLocaleString() + 'a' + (incoming.length < armyList.length ? ' + unknown' : '') : '—'}</dd></div></dl><ArmySummary province={p} /><small>Military report age: {age === null ? 'unknown' : returnLabel(age / 3600)}</small></div>;
}
function ReturnDistribution({ own, enemy }: { own: IntelKingdom | null; enemy: IntelKingdom | null }) {
  const points = useMemo(() => [...returnPoints(own, 'own'), ...returnPoints(enemy, 'enemy')], [own, enemy]);
  const [chosen, setChosen] = useState<ArmyPoint | null>(null);
  const domain = Math.max(1, Math.ceil(Math.max(0, ...points.map(p => p.hours))));
  const binHours = Math.max(1, Math.ceil(domain / 24));
  const bins = Array.from({ length: Math.ceil(domain / binHours) }, (_, i) => ({ start: i * binHours, own: 0, enemy: 0 }));
  points.forEach(p => { bins[Math.min(bins.length - 1, Math.floor(p.hours / binHours))][p.side]++; });
  const maxCount = Math.max(1, ...bins.flatMap(b => [b.own, b.enemy]));
  const x = (hours: number) => 70 + hours / domain * 900;
  const ownCount = points.filter(p => p.side === 'own').length;
  const outliers = points.filter(p => p.outlier);
  const currentChoice = chosen ? points.find(p => p.side === chosen.side && p.provinceId === chosen.provinceId && p.army === chosen.army) : undefined;
  const description = (p: ArmyPoint) => `${p.side === 'own' ? 'Own' : 'Enemy'} #${p.provinceId} ${p.province}, army ${p.army}: ${returnLabel(p.hours)}, ${p.acres ?? 'unknown'} incoming acres${p.outlier ? ', timing outlier' : ''}`;
  return <details className={styles.distribution} open><summary className={styles.distributionToggle}><span>Army return distribution<small>{binHours}h intervals ? lines show army counts</small></span><span className={styles.chartLegend}><span data-side="own">Own ({ownCount})</span><span data-side="enemy">Enemy ({points.length - ownCount})</span><span>Outliers ({outliers.length})</span></span></summary>
    {!points.length ? <p className={styles.empty}>No armies with valid return times were reported.</p> : <>
      <div className={styles.distributionGraph}><svg viewBox="0 0 1000 215" role="group" aria-label="Distribution of army return times for both kingdoms">
        <text x="12" y="15" className={styles.axisLabel}>Armies</text>
        {[...new Set([0, Math.ceil(maxCount / 2), maxCount])].map(count => <g key={count}><line x1="70" y1={120 - count / maxCount * 95} x2="970" y2={120 - count / maxCount * 95} stroke="#415367" strokeDasharray="3 5" /><text x="52" y={125 - count / maxCount * 95} textAnchor="end" className={styles.axisLabel}>{count}</text></g>)}
        {(['own', 'enemy'] as const).map(side => <polyline key={side} data-series={side} fill="none" stroke={side === 'own' ? '#68caff' : '#ffb383'} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" points={bins.length === 1 ? [[70, 120 - bins[0][side] / maxCount * 95], [970, 120 - bins[0][side] / maxCount * 95]].map(pair => pair.join(',')).join(' ') : bins.map(bin => [x(Math.min(domain, bin.start + binHours / 2)), 120 - bin[side] / maxCount * 95].join(',')).join(' ')}><title>{side === 'own' ? 'Own kingdom army counts' : 'Enemy kingdom army counts'}</title></polyline>)}
        <text x="12" y="154" className={styles.axisLabel}>Own</text><text x="12" y="178" className={styles.axisLabel}>Enemy</text>
        <line x1="70" y1="150" x2="970" y2="150" stroke="#33475c" /><line x1="70" y1="174" x2="970" y2="174" stroke="#33475c" />
        {points.map(p => { const y = (p.side === 'own' ? 150 : 174) + ((p.provinceId * 7 + p.army * 5) % 13 - 6); return <circle key={`${p.side}-${p.provinceId}-${p.army}`} cx={x(p.hours)} cy={y} r={p.outlier ? 5 : 3.5} fill={p.side === 'own' ? '#68caff' : '#ffb383'} stroke={p.outlier ? '#f3b5ff' : '#142234'} strokeWidth={p.outlier ? 3 : 1} tabIndex={0} role="button" aria-label={description(p)} onClick={() => setChosen(p)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setChosen(p); } }}><title>{description(p)}</title></circle>; })}
        {Array.from({ length: 7 }, (_, i) => { const h = domain / 6 * i; return <text key={i} x={x(h)} y="205" textAnchor="middle" className={styles.axisLabel}>{Number(h.toFixed(1))}h</text>; })}
      </svg></div>
      <p className={styles.chartHelp}>Hover or select a dot for province details. Return times are as reported at fetch, not a live countdown.</p>
      {currentChoice && <p className={styles.dotDetails}>{description(currentChoice)} · Military report age: {currentChoice.intelAge === null ? 'unknown' : returnLabel(currentChoice.intelAge / 3600)}</p>}
      {outliers.length > 0 && <details className={styles.outlierList}><summary>Timing outliers ({outliers.length})</summary>{outliers.map(p => <button key={`${p.side}-${p.provinceId}-${p.army}`} onClick={() => setChosen(p)}>{description(p)}</button>)}</details>}
    </>}
    <p className={styles.chartHelp}>Military report coverage: own {own ? `${own.provinces.filter(p => Array.isArray(field(p, 'som.armiesAway'))).length}/${own.provinces.length} provinces` : 'kingdom intel unavailable'}; enemy {enemy ? `${enemy.provinces.filter(p => Array.isArray(field(p, 'som.armiesAway'))).length}/${enemy.provinces.length} provinces` : 'kingdom intel unavailable'}.</p>
    <p className={styles.chartHelp}>Outliers use each kingdom’s own return-time distribution (outside 1.5× IQR; at least four armies). Missing or invalid times are excluded. Old reports can distort the distribution.</p>
  </details>;
}
export default function BattleOverview({ own, enemy }: { own: IntelKingdom | null; enemy: IntelKingdom | null }) {
  const [ownId, setOwnId] = useState('');
  const [enemyId, setEnemyId] = useState('');
  const [basis, setBasis] = useState('total');
  const ours = own?.provinces.find(p => String(p.id) === ownId) ?? own?.provinces[0];
  const theirs = enemy?.provinces.find(p => String(p.id) === enemyId) ?? enemy?.provinces[0];
  const offense = (p?: IntelProvince) => numeric(field(p, basis === 'home' ? 'som.offPointsHome' : 'sot.offPoints'));
  return <div className={styles.battleOverview}><ReturnDistribution key={`${own?.location}-${enemy?.location}`} own={own} enemy={enemy} /><details className={styles.faceOff} open><summary>Province face-off <span>Compare reported combat strength</span></summary><div className={styles.faceControls}><label>Own province<select value={ours?.id ?? ''} onChange={e => setOwnId(e.target.value)}>{!own?.provinces.length && <option value="">No own intel</option>}{own?.provinces.map(p => <option key={p.id} value={p.id}>#{p.id} {p.name}</option>)}</select></label><label>Enemy province<select value={theirs?.id ?? ''} onChange={e => setEnemyId(e.target.value)}>{!enemy?.provinces.length && <option value="">No enemy intel</option>}{enemy?.provinces.map(p => <option key={p.id} value={p.id}>#{p.id} {p.name}</option>)}</select></label><label>Compare offense<select value={basis} onChange={e => setBasis(e.target.value)}><option value="total">Total reported offense</option><option value="home">Offense at home only</option></select></label></div><div className={styles.faceGrid}><ProvinceCard p={ours} side="own" /><ProvinceCard p={theirs} side="enemy" /><Power attack={offense(ours)} defense={defenseHome(theirs)} title="Own offense → enemy defense home" tone="own" /><Power attack={offense(theirs)} defense={defenseHome(ours)} title="Enemy offense → own defense home" tone="enemy" /></div><p className={styles.chartHelp}>Ratios compare reported points only. They do not predict attack success or include attack-specific modifiers. Missing intel stays unavailable.</p></details></div>;
}
