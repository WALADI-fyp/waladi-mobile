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

// ── EMQX Cloud (MQTT over WSS) ──
const EMQX_HOST = process.env.EMQX_HOST || "ra216119.ala.eu-central-1.emqxsl.com";
const EMQX_PORT = parseInt(process.env.EMQX_PORT || "8084", 10);

export const EMQX_URL =
  process.env.EMQX_URL || `wss://${EMQX_HOST}:${EMQX_PORT}/mqtt`;
export const EMQX_USERNAME = process.env.EMQX_USERNAME || "waladi_app";
export const EMQX_PASSWORD = process.env.EMQX_PASSWORD || "123456";

// ── MQTT Topics ──
export const AI_POSE_TOPIC = process.env.AI_POSE_TOPIC || "waladi/ai/pose";
export const SLEEP_ALERT_TOPIC =
  process.env.SLEEP_ALERT_TOPIC || "waladi/ai/sleep";
