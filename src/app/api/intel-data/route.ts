import { NextResponse } from 'next/server';
import { getIntelKingdom, IntelApiError, requestIntel } from '@/lib/utopiaIntel';
import { intelParams, integer, IntelInputError } from '@/lib/intelParams';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const headers = { 'Cache-Control': 'private, no-store' };
const resources = new Set(['recent', 'archive', 'war-plan', 'search', 'history', 'races', 'ticks']);

export async function GET(request: Request) {
  try {
    const q = new URL(request.url).searchParams;
    const { server, location } = intelParams(q);
    const resource = q.get('resource') ?? '';
    if (!resources.has(resource)) throw new IntelInputError('Unknown intel section.');
    const side = q.get('side') ?? 'enemy';
    if (side !== 'own' && side !== 'enemy') throw new IntelInputError('side must be own or enemy.');
    // Validate user inputs before any upstream request.
    const slot = integer(q.get('slot'), 1, 1, 25, 'Province slot');
    const numberTicks = integer(q.get('numberTicks'), 72, 1, 288, 'History length');
    const tickId = q.has('tickId') ? integer(q.get('tickId'), 1, 0, 4000, 'Start tick') : undefined;
    const acres = q.has('acres') ? integer(q.get('acres'), 1, 1, 100000000, 'Acres') : undefined;
    const networth = q.has('networth') ? integer(q.get('networth'), 1, 1, 1000000000000, 'Networth') : undefined;
    const provinces = q.has('provinces') ? integer(q.get('provinces'), 1, 1, 25, 'Province count') : undefined;
    let data: unknown;
    let context: Record<string, unknown> = { server, location, side };
    const query = (values: Record<string, string | number>) => new URLSearchParams(Object.entries(values).map(([k, v]) => [k, String(v)]));
    switch (resource) {
      case 'recent': data = await requestIntel(`Kingdom/v1/Recent?server=${server}`); break;
      case 'races': data = await requestIntel(`Data/v1/RaceCombos/${server}`); break;
      case 'ticks': data = await requestIntel('Data/v1/Ticks'); break;
      case 'archive':
      case 'war-plan': {
        const target = side === 'own' ? (await getIntelKingdom(false, server)).kingdom.location : location;
        context = { ...context, location: target, slot };
        const path = resource === 'archive' ? `Province/v1/SotArchive?${query({ server, location: target, slot })}` : `WarPlan/v1/Get?${query({ server, location: target })}`;
        try { data = await requestIntel(path); } catch (error) {
          if (error instanceof IntelApiError && error.status === 404) data = null;
          else throw error;
        }
        break;
      }
      case 'search': {
        const own = acres === undefined || networth === undefined || provinces === undefined ? await getIntelKingdom(false, server) : null;
        const list = own?.kingdom.provinces ?? [];
        const filters = {
          server,
          acres: acres ?? Math.max(1, Math.round(list.reduce((n, p) => n + (p.land ?? 0), 0))),
          networth: networth ?? Math.max(1, Math.round(list.reduce((n, p) => n + (p.networth ?? 0), 0))),
          provinces: provinces ?? Math.max(1, list.length),
        };
        context = { ...context, filters };
        data = await requestIntel('Kingdom/v1/Search', filters);
        break;
      }
      case 'history': {
        const own = await getIntelKingdom(false, server);
        const currentTick = own.currentTick as { tickNumber?: number } | undefined;
        const start = tickId ?? Math.max(0, (currentTick?.tickNumber ?? numberTicks) - numberTicks + 1);
        const locations = [...new Set([own.kingdom.location, location])];
        context = { ...context, numberTicks, tickId: start, locations };
        data = await requestIntel('Kingdom/v1/Ticks', { server, numberTicks, locations, tickId: start });
        break;
      }
    }
    return NextResponse.json({ data, context, fetchedAt: new Date().toISOString() }, { headers });
  } catch (error) {
    const status = error instanceof IntelInputError ? 400 : error instanceof IntelApiError && [401, 403].includes(error.status) ? 403 : 502;
    const message = error instanceof IntelInputError ? error.message : status === 403 ? 'Your intel account does not have access to this data on the selected server.' : 'This intel section could not be loaded. Please try again.';
    return NextResponse.json({ error: message }, { status, headers });
  }
}
