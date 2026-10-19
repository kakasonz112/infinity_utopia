import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";

export type CeasefireState = Record<string, { warsConcluded: number; timestamp: number; isCeasefire: boolean }>;

// Initialize lazily so builds do not need production credentials.
function ceasefireRef() {
  const name = "ceasefire-server";
  let app = getApps().find((candidate) => candidate.name === name);
  if (!app) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
    const databaseURL = process.env.FIREBASE_DATABASE_URL || process.env.NEXT_PUBLIC_FIREBASE_DB_URL;
    if (!projectId || !clientEmail || !privateKey || !databaseURL) throw new Error("Missing Realtime Database server configuration");
    app = initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), databaseURL }, name);
  }
  return getDatabase(app).ref("ceasefire");
}

export async function readCeasefire(): Promise<CeasefireState> {
  const snapshot = await ceasefireRef().once("value");
  const state: CeasefireState = {};
  snapshot.forEach((child) => {
    const row = child.val();
    state[child.key!] = {
      warsConcluded: Number(row.warsConcluded),
      timestamp: Number(row.timestamp),
      isCeasefire: !!row.isCeasefire,
    };
  });
  return state;
}

export async function writeCeasefire(updates: CeasefireState, staleIds: string[] = []) {
  const changes: Record<string, CeasefireState[string] | null> = { ...updates };
  for (const id of staleIds) changes[id] = null;
  // A single atomic update preserves other kingdoms and deletes stale children.
  if (Object.keys(changes).length) await ceasefireRef().update(changes);
}
