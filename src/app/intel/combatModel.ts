import type { IntelKingdom, IntelProvince } from '@/lib/utopiaIntel';

export function numeric(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
export function field(row: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((value, key) => value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined, row);
}
export function compact(value: unknown): string {
  const n = numeric(value);
  if (n === null) return '—';
  return Math.abs(n) >= 1000 ? `${(n / 1000).toLocaleString('en-US', { maximumFractionDigits: 1 })}k` : n.toLocaleString('en-US', { maximumFractionDigits: 2 });
}
export function compactField(key: string): boolean {
  return /(^|\.)(networth|netWorth|offPoints|defPoints|offPointsHome|defPointsHome|mountedOffSpecsRaw|defSpecsRaw)$/.test(key) || key === 'defHome';
}
export function defenseHome(p: IntelProvince | undefined): number | null {
  return numeric(field(p, 'calcs.defPointsSummary.defPointsHome')) ?? numeric(field(p, 'som.defPointsHome')) ?? numeric(field(p, 'sot.defPointsHome'));
}
export function relative(offense: number | null, defense: number | null): number | null {
  return offense !== null && defense !== null && defense > 0 ? offense / defense : null;
}
export type ArmyPoint = { side: 'own' | 'enemy'; province: string; provinceId: number; army: number; hours: number; acres: number | null; intelAge: number | null; outlier: boolean };
export function returnPoints(kingdom: IntelKingdom | null, side: 'own' | 'enemy'): ArmyPoint[] {
  const points: ArmyPoint[] = [];
  for (const p of kingdom?.provinces ?? []) {
    const away = field(p, 'som.armiesAway');
    if (!Array.isArray(away)) continue;
    away.forEach((army, index) => {
      const seconds = numeric(army?.secondsRemaining);
      if (seconds === null || seconds < 0) return;
      points.push({ side, province: p.name, provinceId: p.id, army: index + 1, hours: seconds / 3600, acres: numeric(army.land), intelAge: numeric(field(p, 'som.ageSeconds')), outlier: false });
    });
  }
  if (points.length >= 4) {
    const sorted = points.map(p => p.hours).sort((a, b) => a - b);
    const quantile = (q: number) => { const i = (sorted.length - 1) * q; const base = Math.floor(i); return sorted[base] + (sorted[Math.min(base + 1, sorted.length - 1)] - sorted[base]) * (i - base); };
    const q1 = quantile(.25), q3 = quantile(.75), spread = q3 - q1;
    for (const p of points) p.outlier = p.hours < q1 - 1.5 * spread || p.hours > q3 + 1.5 * spread;
  }
  return points;
}
export function returnLabel(hours: number): string {
  const minutes = Math.max(0, Math.floor(hours * 60 + .000001));
  return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, '0')}`;
}
