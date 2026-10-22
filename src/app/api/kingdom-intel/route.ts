import { NextResponse } from 'next/server';
import { getIntelKingdom } from '@/lib/utopiaIntel';
import { intelParams, IntelInputError } from '@/lib/intelParams';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  const headers = { 'Cache-Control': 'private, no-store' };
  const query = new URL(request.url).searchParams;
  let params;
  try { params = intelParams(query); } catch (error) {
    return NextResponse.json({ error: error instanceof IntelInputError ? error.message : 'Invalid request.' }, { status: 400, headers });
  }
  const { server, location } = params;
  const side = query.get('side');
  if (side !== null) {
    if (side !== 'own' && side !== 'enemy') {
      return NextResponse.json({ error: 'side must be own or enemy' }, { status: 400, headers });
    }
    try {
      return NextResponse.json(await getIntelKingdom(side === 'enemy', server, location), { headers });
    } catch {
      return NextResponse.json({ error: 'Kingdom intel is unavailable. Please try refreshing shortly.' }, { status: 502, headers });
    }
  }
  const results = await Promise.allSettled([getIntelKingdom(false, server), getIntelKingdom(true, server, location)]);
  const result = (index: number) => {
    const entry = results[index];
    return entry.status === 'fulfilled'
      ? { kingdom: entry.value.kingdom, response: entry.value, error: null }
      : { kingdom: null, response: null, error: 'Kingdom intel is unavailable. Please try refreshing shortly.' };
  };
  return NextResponse.json({ own: result(0), enemy: result(1), fetchedAt: new Date().toISOString() }, {
    status: results.every(r => r.status === 'rejected') ? 502 : 200, headers,
  });
}
