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

// 1 tick = 1 real hour
const MS_PER_TICK = 1000 * 60 * 60;

// Always use the *previous* tick start as inferred CF start
function prevTickStart(nowMs: number): number {
  const currentTickStart = Math.floor(nowMs / MS_PER_TICK) * MS_PER_TICK;
  return currentTickStart - MS_PER_TICK;
}

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
    .from("ceasefire")
    .select("id,wars_concluded,timestamp,is_ceasefire");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 3. Process current state
  let ceasefire: CeasefireState = {};
  (ceasefireRows as any[] || []).forEach((row) => {
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
      // First time seeing this kingdom: track warsConcluded, not yet in CF
      updates[key] = {
        warsConcluded: k.warsConcluded,
        timestamp: 0,
        isCeasefire: false,
      };
    } else if (k.warsConcluded > prev.warsConcluded) {
      // NEW ceasefire: war just finished.
      // API only updates once per tick, so infer CF start as previous tick start.
      const nowMs = Date.now();
      const inferredCfStart = prevTickStart(nowMs);

      updates[key] = {
        warsConcluded: k.warsConcluded,
        timestamp: inferredCfStart,
        isCeasefire: true,
      };
    } else {
      // No change in warsConcluded; keep existing record as-is.
      // No need to write it again, so skip adding to updates.
    }
  }

  // 4. Early return if nothing to update
  const entries = Object.entries(updates);
  if (entries.length === 0) {
    return NextResponse.json({ success: true, updated: 0 });
  }

  // 5. Upsert only changed kingdoms
  const upserts = entries.map(([key, value]) =>
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
    (result): result is PromiseRejectedResult => result.status === "rejected"
  );

  if (failed.length > 0) {
    const messages = failed.map((r) => String(r.reason)).join("; ");
    return NextResponse.json(
      { error: `Upsert errors: ${messages}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    updated: entries.length,
  });
}
