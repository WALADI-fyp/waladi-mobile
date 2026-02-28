/**
 * WALDI Backend — Entry Point
 *
 * 1. Initialise the database (create hypertable if needed)
 * 2. Start the SSE ingester (Pi → DB)
 * 3. Start the Express API server (DB → Frontend)
 */

import { initDb } from "./db";
import { startIngester } from "./ingester";
import { startServer } from "./server";

async function main(): Promise<void> {
  console.log("──── WALDI Backend ────");

  // 1. Database
  try {
    await initDb();
    console.log("[main] Database initialised");
  } catch (err) {
    console.error("[main] Failed to initialise database:", err);
    process.exit(1);
  }

  // 2. SSE Ingester (Pi → DB)
  startIngester();

  // 3. Express API
  startServer();
}

main();
