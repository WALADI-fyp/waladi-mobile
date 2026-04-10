/**
 * WALDI Backend Configuration
 */

import dotenv from "dotenv";
dotenv.config();

// ── Server ──
export const PORT = parseInt(process.env.PORT || "3000", 10);

// ── Timescale Cloud ──
export const DATABASE_URL = process.env.DATABASE_URL || "";

if (!DATABASE_URL) {
  throw new Error(
    "[config] Missing DATABASE_URL in environment. Set it in backend/.env",
  );
}
