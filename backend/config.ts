/**
 * WALDI Backend Configuration
 *
 * Loads settings from .env file.
 */

import dotenv from "dotenv";
dotenv.config();

// ── Raspberry Pi ──
export const PI_IP = process.env.PI_IP || "172.20.10.2";
export const PI_STREAM_URL =
  process.env.PI_STREAM_URL || `http://${PI_IP}:8000/stream`;

// ── Server ──
export const PORT = parseInt(process.env.PORT || "3000", 10);

// ── Database ──
export const DB_CONFIG = {
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432", 10),
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "sensors_db",
};
