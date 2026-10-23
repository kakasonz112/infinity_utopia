'use client';

import Kingdom, { type Result } from './KingdomView';
import BattleOverview from './BattleOverview';
import { FetchStatus, LoadingData } from './ResourcePanel';
import { useLiveIntel } from './useLiveIntel';
import styles from './page.module.css';

type Data = { own: Result; enemy: Result; fetchedAt: string };
export default function ProvinceWorkspace({ server, location, side, revision, split }: { server: number; location: string; side: 'own' | 'enemy'; revision: number; split: boolean }) {
  const { data, error, loading, fetchedAt } = useLiveIntel<Data>(`/api/kingdom-intel?${new URLSearchParams({ server: String(server), location })}`, revision);
  return <><FetchStatus time={fetchedAt} />{loading ? <LoadingData /> : error ? <p className={styles.error} role="alert">{error}</p> : data && <>
    <BattleOverview key={`${server}-${location}`} own={data.own.kingdom} enemy={data.enemy.kingdom} />
    {split ? <div className={styles.splitGrid}>{(['own', 'enemy'] as const).map(target => <section key={target} className={styles.splitPane} aria-label={target === 'own' ? 'Own kingdom pane' : 'Enemy kingdom pane'}><div className={styles.paneHeading}>{target === 'own' ? 'Own kingdom' : `Enemy kingdom · ${location}`}</div><Kingdom key={`${server}-${target}-${location}`} result={data[target]} server={server} location={location} side={target} /></section>)}</div> : <Kingdom key={`${server}-${side}-${location}`} result={data[side]} server={server} location={location} side={side} />}
  </>}</>;
}
