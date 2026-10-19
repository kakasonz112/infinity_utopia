const path = require("node:path");
const { loadEnvConfig } = require("@next/env");
const { cert, initializeApp, deleteApp } = require("firebase-admin/app");
const { getDatabase } = require("firebase-admin/database");

// Resolve from the script location, regardless of the caller's directory.
loadEnvConfig(path.resolve(__dirname, ".."), true);

async function main() {
  const required = ["FIREBASE_PROJECT_ID", "FIREBASE_CLIENT_EMAIL", "FIREBASE_PRIVATE_KEY"];
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length) {
    throw new Error(`Missing environment variables: ${missing.join(", ")}`);
  }

  const databaseURL = process.env.FIREBASE_DATABASE_URL || process.env.NEXT_PUBLIC_FIREBASE_DB_URL;
  if (!databaseURL) throw new Error("Missing environment variables: FIREBASE_DATABASE_URL (or NEXT_PUBLIC_FIREBASE_DB_URL)");

  const app = initializeApp({
    databaseURL,
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
  }, "realtime-database-connection-test");
  const db = getDatabase(app);
  try {
    console.log("Testing Realtime Database read access at /ceasefire...");
    const snapshot = await db.ref("ceasefire").limitToFirst(1).once("value");
    console.log("SUCCESS: Realtime Database authentication and read passed.");
    console.log(!snapshot.exists() ? "The ceasefire path is empty; no data was written." : "At least one kingdom exists; no data was changed.");
  } finally {
    await deleteApp(app);
  }
}

// Bound retries so a blocked network cannot leave the command hanging.
const timeout = setTimeout(() => {
  console.error("FAILED: Connection timed out after 30 seconds. Check network access to Google APIs.");
  process.exit(1);
}, 30_000);

main().catch((error) => {
  console.error("FAILED: Realtime Database connection test.");
  // Do not print credentials, document contents, or raw error objects.
  if (error.code === 5 || error.code === "not-found") {
    console.error("Database not found. Check the Realtime Database URL.");
  } else if (error.code === 7 || error.code === "permission-denied") {
    console.error("Permission denied. Check the service account's Realtime Database permissions.");
  } else if (error.code === 16 || error.code === "unauthenticated") {
    console.error("Authentication failed. Check your service-account credentials.");
  } else if (error.message?.startsWith("Missing environment variables:")) {
    console.error(error.message);
  } else {
    console.error("Check credentials, database setup, and network/TLS configuration.");
    if (error.code) console.error(`Error code: ${error.code}`);
  }
  process.exitCode = 1;
}).finally(() => clearTimeout(timeout));
