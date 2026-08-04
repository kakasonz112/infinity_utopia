import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 10;

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  const startedAt = Date.now();

  // A tiny read is enough to count as DB activity on the Free Plan.
  const { error } = await supabase.from("ceasefire").select("id").limit(1);

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message, durationMs: Date.now() - startedAt },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, durationMs: Date.now() - startedAt });
}
