import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// For server-side secrets (DO NOT expose these in _public_ settings)
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type CeasefireState = {
  [key: string]: {
    warsConcluded: number;
    timestamp: number;
  };
};

export async function GET() {
  const { data, error } = await supabase
    .from('ceasefire')
    .select('*');
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Convert DB rows to expected shape
  let state: CeasefireState = {};
  (data as any[] || []).forEach(row => {
    state[row.id as string] = {
      warsConcluded: row.wars_concluded as number,
      timestamp: Number(row.timestamp)
    };
  });
  return NextResponse.json(state);
}

export async function PATCH(req: Request) {
  const updates = await req.json() as CeasefireState;

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

  // Safer null check
  const hasError = results.some(r => r && r.error);
  const messages = results
    .filter(r => r && r.error)
    .map(r => r!.error!.message)
    .join("; ");

  if (hasError) {
    return NextResponse.json({ error: `Upsert errors: ${messages}` }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}

