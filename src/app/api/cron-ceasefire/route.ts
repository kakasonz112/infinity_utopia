import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// For server-side secrets (DO NOT expose these in public settings)
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type UtopiaKingdom = {
  kingdomNumber: number;
  kingdomIsland: number;
  warsConcluded: number;
};

type CeasefireRecord = {
  warsConcluded: number;
  timestamp: number;
  isCeasefire: boolean;
};

type CeasefireState = {
  [key: string]: CeasefireRecord;
};

export async function GET() {
  // 1. Fetch kingdoms data from external Utopia API
  const res = await fetch("https://utopia-game.com/wol/game/kingdoms_dump_v2/");
  if (!res.ok) {
    return NextResponse.json({ error: "Failed to fetch kingdoms API" }, { status: 500 });
  }
  const kingdoms: UtopiaKingdom[] = await res.json();

  // 2. Pull current ceasefire state from Supabase
  const { data: ceasefireRows, error } = await supabase
    .from('ceasefire')
    .select("id,wars_concluded,timestamp,is_ceasefire");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let ceasefire: CeasefireState = {};
  (ceasefireRows as any[] || []).forEach(row => {
    ceasefire[row.id] = {
      warsConcluded: row.wars_concluded,
      timestamp: Number(row.timestamp),
      isCeasefire: !!row.is_ceasefire,
    };
  });

  // 3. Compute updates based on new data
  const updates: CeasefireState = {};
  for (const k of kingdoms) {
    const key = `${k.kingdomNumber}-${k.kingdomIsland}`;
    const prev = ceasefire[key];

    if (!prev) {
      // First-ever entry: not in ceasefire yet, just track warsConcluded
      updates[key] = {
        warsConcluded: k.warsConcluded,
        timestamp: 0,
        isCeasefire: false,
      };
    } else if (k.warsConcluded > prev.warsConcluded) {
      // NEW ceasefire: a war just finished!
      updates[key] = {
        warsConcluded: k.warsConcluded,
        timestamp: Date.now(),
        isCeasefire: true,
      };
    } else if (prev.isCeasefire) {
      // Optionally, implement expiration here if needed in future
      updates[key] = prev;
    } else {
      // No change, keep previous state (not in ceasefire)
      updates[key] = prev;
    }
  }

  // 4. Upsert to Supabase (REPLACEMENT)
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ success: true, updated: 0 });
  }

  const upserts = Object.entries(updates).map(([key, value]) =>
    supabase
      .from("ceasefire")
      .upsert(
        {
          id: key,
          wars_concluded: value.warsConcluded,  // <- Note: was value.warsConcluded
          timestamp: value.timestamp,
          is_ceasefire: value.isCeasefire,
        },
        { onConflict: "id" }
      )
  );

  const results = await Promise.allSettled(upserts);

  console.log("allSettled results:", results);

  const failed = results.filter(
    (result): result is PromiseRejectedResult => result.status === 'rejected'
  );

  if (failed.length > 0) {
    const messages = failed.map(r => String(r.reason)).join("; ");
    console.error("Upsert failures:", failed);
    return NextResponse.json({ 
      error: `Upsert errors: ${messages}` 
    }, { status: 500 });
  }

  return NextResponse.json({ 
    success: true, 
    updated: Object.keys(updates).length 
  });
}
