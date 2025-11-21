import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Supabase setup — uses secure server-side environment variables
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type UtopiaKingdom = {
  kingdomNumber: number;
  kingdomIsland: number;
  warsConcluded: number;
  // ...other fields if you want to track more
};

type CeasefireState = {
  [key: string]: {
    warsConcluded: number;
    timestamp: number;
  };
};

const CEASEFIRE_HOURS = 96;

// Helper to decide if a ceasefire should be refreshed
function shouldRefreshCeasefire(prev: any, k: UtopiaKingdom) {
  // If no previous record or warsConcluded increased, refresh
  return !prev || k.warsConcluded > prev.warsConcluded;
}

export async function GET() {
  // 1. Fetch kingdoms data from Utopia external API
  const res = await fetch("https://utopia-game.com/wol/game/kingdoms_dump_v2/");
  if (!res.ok) {
    return NextResponse.json({ error: "Failed to fetch kingdoms API" }, { status: 500 });
  }
  const kingdoms: UtopiaKingdom[] = await res.json();

  // 2. Pull current ceasefire state
  const { data: ceasefireRows, error } = await supabase
    .from('ceasefire')
    .select('*');
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let ceasefire: CeasefireState = {};
  (ceasefireRows as any[] || []).forEach(row => {
    ceasefire[row.id] = {
      warsConcluded: row.wars_concluded,
      timestamp: Number(row.timestamp),
    };
  });

  // 3. Compute updates based on new data
  const updates: CeasefireState = {};
  for (const k of kingdoms) {
    const key = `${k.kingdomNumber}-${k.kingdomIsland}`;
    const prev = ceasefire[key];
    // Only trigger new ceasefire if warsConcluded just increased
    if (shouldRefreshCeasefire(prev, k) && k.warsConcluded > 0) {
    updates[key] = {
        warsConcluded: k.warsConcluded,
        timestamp: Date.now(),
    };
    } else if (prev) {
    // Keep previous info if not changed
    updates[key] = prev;
    } else {
    // First ever load: set warsConcluded, but timestamp = 0
    updates[key] = {
        warsConcluded: k.warsConcluded,
        timestamp: 0
    };
    }

    // else if no wars concluded and no previous, omit — stays undefined
  }

  // 4. Upsert updates to Supabase
  const upserts = Object.entries(updates).map(([key, value]) =>
    supabase
      .from('ceasefire')
      .upsert(
        {
          id: key,
          wars_concluded: value.warsConcluded,
          timestamp: value.timestamp,
        },
        { onConflict: 'id' }
      )
  );
  const results = await Promise.all(upserts);
  const hasError = results.some(r => r && r.error);
  if (hasError) {
    const messages = results.filter(r => r && r.error).map(r => r!.error!.message).join("; ");
    return NextResponse.json({ error: `Upsert errors: ${messages}` }, { status: 500 });
  }

  return NextResponse.json({ success: true, updated: Object.keys(updates).length });
}
