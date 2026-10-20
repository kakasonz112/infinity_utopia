import type { Ceasefire, Kingdom, Province } from './model';

export type KingdomsData = { startDate: string; endDate: string; lastUpdated: string; kingdoms: Kingdom[] };
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const numeric = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const count = (value: unknown) => numeric(value) && Number.isInteger(value);

export function parseKingdoms(payload: unknown): KingdomsData {
  if (!object(payload) || !object(payload.kingdoms)) throw new Error('Invalid kingdom snapshot');
  const data = payload.kingdoms;
  if (!Array.isArray(data.kingdoms)) throw new Error('Missing kingdom records');
  const ids = new Set<string>();
  const kingdoms = data.kingdoms.map((row: unknown): Kingdom => {
    if (!object(row) || !count(row.kingdomNumber) || !/^\d+$/.test(String(row.kingdomIsland)) ||
        !['honor', 'networth', 'totalLand', 'warScore'].every(key => numeric(row[key])) ||
        !['provinceCount', 'warsConcluded', 'warsWon'].every(key => count(row[key])) ||
        Number(row.warsWon) > Number(row.warsConcluded) || !Array.isArray(row.provinces)) throw new Error('Invalid kingdom record');
    const id = `${row.kingdomNumber}-${row.kingdomIsland}`;
    if (ids.has(id)) throw new Error('Duplicate kingdom record');
    ids.add(id);
    const slots = new Set<number>();
    const provinces = row.provinces.map((p: unknown): Province => {
      if (!object(p) || !count(p.slot) || typeof p.name !== 'string' || typeof p.protected !== 'boolean' || slots.has(p.slot as number)) throw new Error('Invalid province record');
      slots.add(p.slot as number);
      return { slot: p.slot as number, name: p.name, race: typeof p.race === 'string' ? p.race : 'Unknown', honorName: typeof p.honorName === 'string' ? p.honorName : '', protected: p.protected,
        land: numeric(p.land) ? p.land : NaN, networth: numeric(p.networth) ? p.networth : NaN };
    });
    return { ...row, kingdomIsland: String(row.kingdomIsland), kingdomName: typeof row.kingdomName === 'string' ? row.kingdomName : undefined, provinces } as Kingdom;
  });
  return { kingdoms, startDate: typeof data.startDate === 'string' ? data.startDate : '', endDate: typeof data.endDate === 'string' ? data.endDate : '', lastUpdated: typeof data.lastUpdated === 'string' ? data.lastUpdated : '' };
}

export function parseCeasefires(payload: unknown) {
  if (!object(payload) || !object(payload.data)) throw new Error('Invalid ceasefire response');
  const data: Record<string, Ceasefire> = {};
  for (const [id, record] of Object.entries(payload.data)) {
    if (!/^\d+-\d+$/.test(id) || !object(record) || !numeric(record.timestamp) || !count(record.warsConcluded) || typeof record.isCeasefire !== 'boolean') throw new Error('Invalid ceasefire record');
    data[id] = record as Ceasefire;
  }
  return { data, lastUpdated: typeof payload.lastUpdated === 'string' ? payload.lastUpdated : '' };
}
