import { NextResponse } from "next/server";
import { readCeasefire, writeCeasefire, type CeasefireState } from "@/lib/ceasefireStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ lastUpdated: new Date().toISOString(), data: await readCeasefire() });
  } catch (error) {
    console.error("Failed to read ceasefire state", error);
    return NextResponse.json({ error: "Failed to read ceasefire state" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let updates: CeasefireState;
  try {
    updates = await req.json();
    if (!updates || typeof updates !== "object" || Array.isArray(updates) ||
      Object.entries(updates).some(([id, value]) =>
        !/^\d+-\d+$/.test(id) || !value ||
        !Number.isInteger(value.warsConcluded) || value.warsConcluded < 0 ||
        !Number.isFinite(value.timestamp) || value.timestamp < 0 ||
        typeof value.isCeasefire !== "boolean")) {
      return NextResponse.json({ error: "Invalid ceasefire state" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  try {
    await writeCeasefire(updates);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update ceasefire state", error);
    return NextResponse.json({ error: "Failed to update ceasefire state" }, { status: 500 });
  }
}
