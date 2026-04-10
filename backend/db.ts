/**
 * Database connection — Timescale Cloud.
 */
import { Pool } from "pg";
import { DATABASE_URL } from "./config";

function normalizeConnectionString(rawUrl: string): string {
  if (!rawUrl.includes("sslmode=require")) {
    return rawUrl;
  }

  if (rawUrl.includes("uselibpqcompat=")) {
    return rawUrl;
  }

  const separator = rawUrl.includes("?") ? "&" : "?";
  return `${rawUrl}${separator}uselibpqcompat=true`;
}

export const pool = new Pool({
  connectionString: normalizeConnectionString(DATABASE_URL),
  ssl: { rejectUnauthorized: false },
});

pool.on("error", (err) => {
  console.error("[db] Unexpected idle client error:", err);
});

export async function verifyDatabaseConnection(): Promise<void> {
  const client = await pool.connect();
  try {
    const result = await client.query<{
      current_database: string;
      current_user: string;
    }>("SELECT current_database(), current_user");
    const row = result.rows[0];
    console.log(
      `[db] Connected to database "${row.current_database}" as "${row.current_user}"`,
    );
  } finally {
    client.release();
  }
}
