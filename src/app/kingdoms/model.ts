export type Province = { slot: number; name: string; land: number; race: string; honorName: string; networth: number; protected: boolean };
export type Kingdom = { kingdomName?: string; kingdomNumber: number; kingdomIsland: string; honor: number; networth: number; totalLand: number; provinceCount: number; warsConcluded: number; warsWon: number; warScore: number; provinces: Province[] };
export type Ceasefire = { timestamp: number; isCeasefire: boolean; warsConcluded: number };
export type Sort = { key: keyof Kingdom | "location" | "status"; direction: "ASC" | "DESC" };
export const kingdomKey = (kingdom: Kingdom) => `${kingdom.kingdomNumber}-${kingdom.kingdomIsland}`;
export const location = (kingdom: Kingdom) => `${kingdom.kingdomNumber}:${kingdom.kingdomIsland}`;
export const kingdomLabel = (kingdom: Kingdom) => `${kingdom.kingdomName || 'Unnamed kingdom'} (${location(kingdom)})`;
// Preserve the existing 96-hour period plus the 2-tick estimate adjustment.
export function remainingTicks(record: Ceasefire | undefined, now: number) {
  return record?.isCeasefire && Number.isFinite(record.timestamp) ? Math.max(0, 98 - (now - record.timestamp) / 3600000) : 0;
}
export function expiryDate(record: Ceasefire, startDate: string) {
  const start = Date.parse(/(?:Z|[+-]\d\d:\d\d)$/.test(startDate) ? startDate : startDate + 'Z');
  if (!Number.isFinite(start)) return null;
  const ticks = Math.round((record.timestamp + 96 * 3600000 - start) / 3600000) + 2;
  if (ticks < 0) return null;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'June', 'Jul'];
  return `${months[Math.floor((ticks % 168) / 24)]} ${ticks % 24 + 1} YR ${Math.floor(ticks / 168)}`;
}
export function compareKingdoms(a: Kingdom, b: Kingdom, sorts: Sort[], ceasefire: Record<string, Ceasefire>, now: number) {
  for (const { key, direction } of sorts) {
    let result = 0;
    if (key === 'location') result = a.kingdomNumber - b.kingdomNumber || String(a.kingdomIsland).localeCompare(String(b.kingdomIsland), undefined, { numeric: true });
    else if (key === 'status') result = remainingTicks(ceasefire[kingdomKey(a)], now) - remainingTicks(ceasefire[kingdomKey(b)], now);
    else {
      const av = a[key] ?? '', bv = b[key] ?? '';
      result = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv), undefined, { numeric: true });
    }
    if (result) return result * (direction === 'ASC' ? 1 : -1);
  }
  return 0;
}
export function summarizeSnapshot(kingdoms: Kingdom[]) {
  const median = (values: number[]) => {
    if (!values.length) return null;
    values.sort((a, b) => a - b);
    const middle = Math.floor(values.length / 2);
    return values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
  };
  const raceCounts: Record<string, number> = {};
  const listedProvinces: { province: Province; kingdom: Kingdom }[] = [];
  for (const kingdom of kingdoms) for (const province of kingdom.provinces ?? []) {
    listedProvinces.push({ province, kingdom });
    const race = province.race || 'Unknown';
    raceCounts[race] = (raceCounts[race] || 0) + 1;
  }
  const races = Object.entries(raceCounts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const eligible = kingdoms.filter(k => k.warsConcluded >= 3);
  const bestRate = eligible.length ? Math.max(...eligible.map(k => k.warsWon / k.warsConcluded)) : null;
  const leaders = eligible.filter(k => k.warsWon / k.warsConcluded === bestRate);
  const top = <T,>(rows: T[], value: (row: T) => number) => {
    let best = -Infinity;
    let winners: T[] = [];
    for (const row of rows) {
      const n = value(row);
      if (!Number.isFinite(n) || n < 0) continue;
      if (n > best) { best = n; winners = [row]; }
      else if (n === best) winners.push(row);
    }
    return winners;
  };
  const landLeaders = top(kingdoms, k => k.totalLand);
  const networthLeaders = top(kingdoms, k => k.networth);
  const validValue = (value: number) => Number.isFinite(value) && value >= 0;
  const provinceLand = listedProvinces.filter(({ province }) => validValue(province.land));
  const provinceNetworth = listedProvinces.filter(({ province }) => validValue(province.networth));
  const provinceLandLeaders = top(provinceLand, row => row.province.land);
  const provinceNetworthLeaders = top(provinceNetworth, row => row.province.networth);
  const landValues = kingdoms.map(k => k.totalLand).filter(validValue);
  const networthValues = kingdoms.map(k => k.networth).filter(validValue);
  return {
    provinces: kingdoms.reduce((n, k) => n + k.provinceCount, 0),
    medianLand: median(landValues), medianNetworth: median(networthValues),
    totalLand: landValues.reduce((sum, value) => sum + value, 0),
    totalNetworth: networthValues.reduce((sum, value) => sum + value, 0),
    medianProvinceLand: median(provinceLand.map(row => row.province.land)),
    medianProvinceNetworth: median(provinceNetworth.map(row => row.province.networth)),
    provinceLandCount: provinceLand.length, provinceNetworthCount: provinceNetworth.length,
    largestProvinceLand: provinceLandLeaders[0] ?? null,
    largestProvinceNetworth: provinceNetworthLeaders[0] ?? null,
    races, raceTotal: races.reduce((n, [, count]) => n + count, 0), bestRate, leaders, landLeaders, networthLeaders, provinceLandLeaders, provinceNetworthLeaders,
    largestLand: landLeaders[0] ?? null, largestNetworth: networthLeaders[0] ?? null,
  };
}

export function summarizeCeasefires(kingdoms: Kingdom[], ceasefire: Record<string, Ceasefire>, now: number) {
  const active = kingdoms.map(kingdom => ({ kingdom, ticks: remainingTicks(ceasefire[kingdomKey(kingdom)], now) })).filter(row => row.ticks > 0).sort((a, b) => a.ticks - b.ticks);
  return { active, endingSoon: active.filter(row => row.ticks <= 12).length };
}
// Compatibility entry point for calculation consumers.
export function summarize(kingdoms: Kingdom[], ceasefire: Record<string, Ceasefire>, now: number) {
  return { ...summarizeSnapshot(kingdoms), ...summarizeCeasefires(kingdoms, ceasefire, now) };
}
