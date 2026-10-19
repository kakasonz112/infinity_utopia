import { NextResponse } from "next/server";
import { readCeasefire, writeCeasefire, type CeasefireState } from "@/lib/ceasefireStore";

export const maxDuration = 30;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UtopiaKingdom = {
  kingdomNumber: number;
  kingdomIsland: number;
  warsConcluded: number;
};

// 1 tick = 1 real hour
const MS_PER_TICK = 1000 * 60 * 60;
const KINGDOMS_FETCH_TIMEOUT_MS = 12000;

// Always use the *previous* tick start as inferred CF start
function prevTickStart(nowMs: number): number {
  const currentTickStart = Math.floor(nowMs / MS_PER_TICK) * MS_PER_TICK;
  return currentTickStart - MS_PER_TICK;
}

export async function GET(req: Request) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
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
    const kingdoms: UtopiaKingdom[] = kingdomsJson.kingdoms;
    if (!Array.isArray(kingdoms) || kingdoms.length === 0 || kingdoms.some((k) =>
      !Number.isInteger(k.kingdomNumber) || !Number.isInteger(k.kingdomIsland) ||
      !Number.isInteger(k.warsConcluded) || k.warsConcluded < 0)) {
      return NextResponse.json({ error: "Invalid or empty kingdoms dump" }, { status: 502 });
    }
    const ceasefire = await readCeasefire();
    const existingIds = new Set(Object.keys(ceasefire));

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
    await writeCeasefire(updates, staleIds);
    const entries = Object.entries(updates);

    return NextResponse.json({
      success: true,
      updated: entries.length,
      deleted: staleIds.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// External schedulers can use GET or POST.
export const POST = GET;
