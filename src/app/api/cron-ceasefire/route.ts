import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 30;

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
const KINGDOMS_FETCH_TIMEOUT_MS = 12000;

// Always use the *previous* tick start as inferred CF start
function prevTickStart(nowMs: number): number {
  const currentTickStart = Math.floor(nowMs / MS_PER_TICK) * MS_PER_TICK;
  return currentTickStart - MS_PER_TICK;
}

export async function GET() {
  try {
    // 1. Fetch kingdoms data with a hard timeout so the cron doesn't hang.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), KINGDOMS_FETCH_TIMEOUT_MS);

    let res: Response;
    try {
      res = await fetch("https://utopia-game.com/wol/game/kingdoms_dump_v2/", {
        signal: controller.signal,
        cache: "no-store",
      });
    } finally {
      clearTimeout(timeoutId);
    }

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
    const ceasefire: CeasefireState = {};
    const existingIds = new Set<string>();
    (ceasefireRows as any[] || []).forEach((row) => {
      existingIds.add(String(row.id));
      ceasefire[row.id] = {
        warsConcluded: row.wars_concluded,
        timestamp: Number(row.timestamp),
        isCeasefire: !!row.is_ceasefire,
      };
    });

    const updates: CeasefireState = {};

    const currentIds = new Set<string>();
    for (const k of kingdoms) {
      const key = `${k.kingdomNumber}-${k.kingdomIsland}`;
      currentIds.add(key);
      const prev = ceasefire[key];

      if (!prev) {
        // First time seeing this kingdom: track warsConcluded, not yet in CF
        updates[key] = {
          warsConcluded: k.warsConcluded,
          timestamp: 0,
          isCeasefire: false,
        };
      } else if (k.warsConcluded < prev.warsConcluded) {
        // Age reset (warsConcluded counter rolled over). Reset CF state.
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
      }
    }

    // 3b. Remove stale kingdoms that no longer exist in the dump
    const staleIds = [...existingIds].filter((id) => !currentIds.has(id));
    if (staleIds.length > 0) {
      const { error: deleteError } = await supabase
        .from("ceasefire")
        .delete()
        .in("id", staleIds);

      if (deleteError) {
        return NextResponse.json({ error: deleteError.message }, { status: 500 });
      }
    }

    // 4. Early return if nothing to update
    const entries = Object.entries(updates);
    if (entries.length === 0) {
      return NextResponse.json({ success: true, updated: 0 });
    }

    // 5. Bulk upsert changed kingdoms in a single request to avoid fanout latency.
    const upsertPayload = entries.map(([key, value]) => ({
      id: key,
      wars_concluded: value.warsConcluded,
      timestamp: value.timestamp,
      is_ceasefire: value.isCeasefire,
    }));

    const { error: upsertError } = await supabase
      .from("ceasefire")
      .upsert(upsertPayload, { onConflict: "id" });

    if (upsertError) {
      return NextResponse.json(
        { error: `Upsert errors: ${upsertError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      updated: entries.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
