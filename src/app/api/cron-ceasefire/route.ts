import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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
  // 1. Fetch kingdoms data
  const res = await fetch("https://utopia-game.com/wol/game/kingdoms_dump_v2/");
  if (!res.ok) {
    return NextResponse.json({ error: "Failed to fetch kingdoms API" }, { status: 500 });
  }

  const kingdomsJson = await res.json();
  const kingdoms: UtopiaKingdom[] = kingdomsJson.kingdoms || [];

  // 2. Supabase read
  const { data: ceasefireRows, error } = await supabase
    .from('ceasefire')
    .select("id,wars_concluded,timestamp,is_ceasefire");
    
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 3. Process updates
  let ceasefire: CeasefireState = {};
  (ceasefireRows as any[] || []).forEach(row => {
    ceasefire[row.id] = {
      warsConcluded: row.wars_concluded,
      timestamp: Number(row.timestamp),
      isCeasefire: !!row.is_ceasefire,
    };
  });

  const updates: CeasefireState = {};
  for (const k of kingdoms) {
    const key = `${k.kingdomNumber}-${k.kingdomIsland}`;
    const prev = ceasefire[key];

    if (!prev) {
      updates[key] = { warsConcluded: k.warsConcluded, timestamp: 0, isCeasefire: false };
    } else if (k.warsConcluded > prev.warsConcluded) {
      updates[key] = { warsConcluded: k.warsConcluded, timestamp: Date.now(), isCeasefire: true };
    } else if (prev.isCeasefire) {
      updates[key] = prev;
    } else {
      updates[key] = prev;
    }
  }

  // 4. Early return if nothing to update
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ success: true, updated: 0 });
  }

  // 5. Upsert
  const upserts = Object.entries(updates).map(([key, value]) =>
    supabase
      .from("ceasefire")
      .upsert(
        {
          id: key,
          wars_concluded: value.warsConcluded,
          timestamp: value.timestamp,
          is_ceasefire: value.isCeasefire,
        },
        { onConflict: "id" }
      )
  );

  const results = await Promise.allSettled(upserts);

  const failed = results.filter(
    (result): result is PromiseRejectedResult => result.status === 'rejected'
  );

  if (failed.length > 0) {
    const messages = failed.map(r => String(r.reason)).join("; ");
    return NextResponse.json({ 
      error: `Upsert errors: ${messages}` 
    }, { status: 500 });
  }

  return NextResponse.json({ 
    success: true, 
    updated: Object.keys(updates).length 
  });
}
