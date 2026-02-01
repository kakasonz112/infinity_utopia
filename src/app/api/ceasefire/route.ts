import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// For server-side secrets
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type CeasefireState = {
  [key: string]: {
    warsConcluded: number;  
    timestamp: number;
    isCeasefire: boolean;
  };
};

export async function GET() {
  const { data, error } = await supabase
    .from("ceasefire")
    .select("*");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let state: CeasefireState = {};
  (data as any[] || []).forEach(row => {
    state[row.id as string] = {
      warsConcluded: row.wars_concluded as number,
      timestamp: Number(row.timestamp),
      isCeasefire: !!row.is_ceasefire,
    };
  });
  return NextResponse.json({
    lastUpdated: new Date().toISOString(),
    data: state,
  });
}

export async function PATCH(req: Request) {
  const updates = await req.json() as CeasefireState;

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

  const results = await Promise.all(upserts);

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
