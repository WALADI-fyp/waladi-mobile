/**
 * WALADI REST API
 *
 * Endpoints:
 *   GET  /api/readings        → historical readings (from, to, limit)
 *   POST /api/devices/claim   → pair a device to a user (auth)
 *   GET  /api/devices         → list user's devices (auth)
 *   GET  /api/sensor-data     → user's sensor data (auth)
 */

import express from "express";
import cors from "cors";
import { clerkMiddleware, requireAuth, getAuth } from "@clerk/express";
import { PORT } from "./config";
import { pool, verifyDatabaseConnection } from "./db";

const app = express();
app.use(cors());
app.use(express.json());

// Clerk middleware — parses auth on all requests (non-blocking)
app.use(clerkMiddleware());

// ── GET /api/readings ──
app.get("/api/readings", async (req, res) => {
  try {
    const limit = Math.min(
      parseInt((req.query.limit as string) || "100", 10),
      1000,
    );
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;

    let query = `
      SELECT time, source, heart_rate_bpm, breathing_rate_bpm,
             room_temperature_c, body_temperature_c, room_humidity_rh, mock_fields,
             device_id, user_id
      FROM sensor_readings
    `;
    const params: any[] = [];
    const conditions: string[] = [];

    // If authenticated, scope to user's data
    const auth = getAuth(req);
    if (auth?.userId) {
      params.push(auth.userId);
      conditions.push(`user_id = $${params.length}`);
    }

    if (from) {
      params.push(from);
      conditions.push(`time >= $${params.length}`);
    }
    if (to) {
      params.push(to);
      conditions.push(`time <= $${params.length}`);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(" AND ")}`;
    }

    query += ` ORDER BY time DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await pool.query(query, params);
    return res.json(result.rows);
  } catch (err) {
    console.error("[server] /api/readings error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /api/devices/claim (auth required) ──
// Links a Pi device to the authenticated user.
app.post("/api/devices/claim", requireAuth(), async (req: any, res) => {
  const { userId } = getAuth(req);
  const { device_id, name } = req.body;

  if (!device_id) {
    return res.status(400).json({ error: "device_id is required" });
  }

  try {
    // Upsert: if device already claimed, update the owner
    const result = await pool.query(
      `INSERT INTO user_devices (user_id, device_id, name)
       VALUES ($1, $2, $3)
       ON CONFLICT (device_id)
       DO UPDATE SET user_id = $1, name = COALESCE($3, user_devices.name)
       RETURNING *`,
      [userId, device_id, name || "My Device"],
    );
    return res.json({ success: true, device: result.rows[0] });
  } catch (err) {
    console.error("[server] /api/devices/claim error:", err);
    return res.status(500).json({ error: "Failed to claim device" });
  }
});

// ── GET /api/devices (auth required) ──
// Lists all devices for the authenticated user.
app.get("/api/devices", requireAuth(), async (req: any, res) => {
  const { userId } = getAuth(req);

  try {
    const result = await pool.query(
      "SELECT * FROM user_devices WHERE user_id = $1 ORDER BY created_at DESC",
      [userId],
    );
    return res.json(result.rows);
  } catch (err) {
    console.error("[server] /api/devices error:", err);
    return res.status(500).json({ error: "Failed to list devices" });
  }
});

// ── GET /api/sensor-data (auth required) ──
// Fetches sensor data for the authenticated user.
app.get("/api/sensor-data", requireAuth(), async (req: any, res) => {
  const { userId } = getAuth(req);
  const limit = Math.min(
    parseInt((req.query.limit as string) || "100", 10),
    1000,
  );

  try {
    const result = await pool.query(
      `SELECT time, source, heart_rate_bpm, breathing_rate_bpm,
              room_temperature_c, body_temperature_c, room_humidity_rh,
              mock_fields, device_id
       FROM sensor_readings
       WHERE user_id = $1
       ORDER BY time DESC
       LIMIT $2`,
      [userId, limit],
    );
    return res.json(result.rows);
  } catch (err) {
    console.error("[server] /api/sensor-data error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/analytics (auth required) ──
// Returns time-bucketed averages for all vitals.
//
// Query params:
//   range  → "24h" (default) | "7d" | "30d"
//
// Bucket sizes:
//   24h  → 1-hour buckets
//   7d   → 6-hour buckets
//   30d  → 1-day buckets
app.get("/api/analytics", requireAuth(), async (req: any, res) => {
  const { userId } = getAuth(req);
  const range = (req.query.range as string) || "24h";

  let interval: string;
  let bucket: string;

  switch (range) {
    case "7d":
      interval = "7 days";
      bucket = "6 hours";
      break;
    case "30d":
      interval = "30 days";
      bucket = "1 day";
      break;
    case "24h":
    default:
      interval = "24 hours";
      bucket = "1 hour";
      break;
  }

  try {
    const result = await pool.query(
      `SELECT
         time_bucket($1::interval, time)   AS bucket,
         AVG(heart_rate_bpm)               AS avg_heart_rate,
         AVG(breathing_rate_bpm)           AS avg_breathing_rate,
         AVG(body_temperature_c)           AS avg_body_temp,
         AVG(room_temperature_c)           AS avg_room_temp,
         AVG(room_humidity_rh)             AS avg_humidity,
         COUNT(*)                          AS sample_count
       FROM sensor_readings
       WHERE user_id = $2
         AND time >= NOW() - $3::interval
       GROUP BY bucket
       ORDER BY bucket ASC`,
      [bucket, userId, interval],
    );
    return res.json(result.rows);
  } catch (err) {
    console.error("[server] /api/analytics error:", err);
    return res.status(500).json({ error: "Failed to fetch analytics" });
  }
});

export async function startServer(): Promise<void> {
  await verifyDatabaseConnection();

  app.listen(PORT, () => {
    console.log(`[server] Listening on http://0.0.0.0:${PORT}`);
    console.log(`[server]   GET  /api/readings`);
    console.log(`[server]   POST /api/devices/claim`);
    console.log(`[server]   GET  /api/devices`);
    console.log(`[server]   GET  /api/sensor-data`);
    console.log(`[server]   GET  /api/analytics?range=24h|7d|30d`);
  });
}
