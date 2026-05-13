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

function isExpoPushToken(value: unknown): value is string {
  return (
    typeof value === "string" &&
    (value.startsWith("ExponentPushToken[") ||
      value.startsWith("ExpoPushToken["))
  );
}

async function ensurePushTokenTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_push_tokens (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      expo_push_token TEXT NOT NULL UNIQUE,
      platform TEXT,
      device_id TEXT,
      enabled BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_user_push_tokens_user_id
     ON user_push_tokens(user_id)`,
  );
}

async function ensureDerivedAlertTables(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sleep_alerts (
      id SERIAL PRIMARY KEY,
      alert_id TEXT NOT NULL,
      user_id TEXT,
      device_id TEXT NOT NULL,
      started_at TIMESTAMPTZ NOT NULL,
      ended_at TIMESTAMPTZ,
      duration_s DOUBLE PRECISION,
      ear_start DOUBLE PRECISION,
      ear_end DOUBLE PRECISION,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(alert_id, user_id)
    )
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_sleep_alerts_user_started
     ON sleep_alerts(user_id, started_at DESC)`,
  );
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_sleep_alerts_device_active
     ON sleep_alerts(device_id, ended_at)`,
  );

  await pool.query(`
    CREATE TABLE IF NOT EXISTS risky_posture_alerts (
      id SERIAL PRIMARY KEY,
      alert_id TEXT NOT NULL,
      user_id TEXT,
      device_id TEXT NOT NULL,
      detected_at TIMESTAMPTZ NOT NULL,
      nose_confidence DOUBLE PRECISION,
      face_found BOOLEAN,
      eyes_visible INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(alert_id, user_id)
    )
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_risky_posture_alerts_user_detected
     ON risky_posture_alerts(user_id, detected_at DESC)`,
  );
}

async function ensureWeeklyReportsTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS weekly_reports (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      week_start TIMESTAMPTZ NOT NULL,
      week_end TIMESTAMPTZ NOT NULL,
      avg_heart_rate_bpm DOUBLE PRECISION,
      avg_breathing_rate_bpm DOUBLE PRECISION,
      avg_room_temperature_c DOUBLE PRECISION,
      avg_room_humidity_rh DOUBLE PRECISION,
      avg_body_temperature_c DOUBLE PRECISION,
      total_cry_events INTEGER NOT NULL DEFAULT 0,
      total_cry_duration_s DOUBLE PRECISION NOT NULL DEFAULT 0,
      longest_cry_duration_s DOUBLE PRECISION NOT NULL DEFAULT 0,
      total_sleep_sessions INTEGER NOT NULL DEFAULT 0,
      total_sleep_duration_s DOUBLE PRECISION NOT NULL DEFAULT 0,
      avg_sleep_duration_s DOUBLE PRECISION NOT NULL DEFAULT 0,
      longest_sleep_duration_s DOUBLE PRECISION NOT NULL DEFAULT 0,
      total_risky_posture_events INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, device_id, week_start)
    )
  `);

  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_weekly_reports_user_week
     ON weekly_reports(user_id, week_start DESC)`,
  );
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_weekly_reports_user_device_week
     ON weekly_reports(user_id, device_id, week_start DESC)`,
  );
}

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

// ── GET /api/alerts/cry (auth required) ──
// Returns latest cry alerts for the authenticated user.
app.get("/api/alerts/cry", requireAuth(), async (req: any, res) => {
  const { userId } = getAuth(req);
  const limit = Math.min(
    parseInt((req.query.limit as string) || "50", 10),
    200,
  );

  try {
    const result = await pool.query(
      `SELECT *
       FROM cry_alerts
       WHERE user_id = $1
       ORDER BY started_at DESC
       LIMIT $2`,
      [userId, limit],
    );
    return res.json(result.rows);
  } catch (err) {
    console.error("[server] /api/alerts/cry error:", err);
    return res.status(500).json({ error: "Failed to fetch cry alerts" });
  }
});

// ── GET /api/alerts/sleep (auth required) ──
// Returns latest sleep sessions for the authenticated user.
app.get("/api/alerts/sleep", requireAuth(), async (req: any, res) => {
  const { userId } = getAuth(req);
  const limit = Math.min(
    parseInt((req.query.limit as string) || "50", 10),
    200,
  );

  try {
    const result = await pool.query(
      `SELECT *
       FROM sleep_alerts
       WHERE user_id = $1
       ORDER BY started_at DESC
       LIMIT $2`,
      [userId, limit],
    );
    return res.json(result.rows);
  } catch (err) {
    console.error("[server] /api/alerts/sleep error:", err);
    return res.status(500).json({ error: "Failed to fetch sleep alerts" });
  }
});

// ── GET /api/alerts/risky-posture (auth required) ──
// Returns latest risky posture alerts for the authenticated user.
app.get("/api/alerts/risky-posture", requireAuth(), async (req: any, res) => {
  const { userId } = getAuth(req);
  const limit = Math.min(
    parseInt((req.query.limit as string) || "50", 10),
    200,
  );

  try {
    const result = await pool.query(
      `SELECT *
       FROM risky_posture_alerts
       WHERE user_id = $1
       ORDER BY detected_at DESC
       LIMIT $2`,
      [userId, limit],
    );
    return res.json(result.rows);
  } catch (err) {
    console.error("[server] /api/alerts/risky-posture error:", err);
    return res
      .status(500)
      .json({ error: "Failed to fetch risky posture alerts" });
  }
});

// ── GET /api/alerts/temperature (auth required) ──
// Returns latest temperature alerts for the authenticated user.
app.get("/api/alerts/temperature", requireAuth(), async (req: any, res) => {
  const { userId } = getAuth(req);
  const limit = Math.min(
    parseInt((req.query.limit as string) || "50", 10),
    200,
  );

  try {
    const result = await pool.query(
      `SELECT *
       FROM temperature_alerts
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit],
    );
    return res.json(result.rows);
  } catch (err) {
    console.error("[server] /api/alerts/temperature error:", err);
    return res.status(500).json({ error: "Failed to fetch temperature alerts" });
  }
});

// ── GET /api/alerts/vitals (auth required) ──
// Returns latest vital alerts for the authenticated user.
app.get("/api/alerts/vitals", requireAuth(), async (req: any, res) => {
  const { userId } = getAuth(req);
  const limit = Math.min(
    parseInt((req.query.limit as string) || "50", 10),
    200,
  );

  try {
    const result = await pool.query(
      `SELECT *
       FROM vital_alerts
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit],
    );
    return res.json(result.rows);
  } catch (err) {
    console.error("[server] /api/alerts/vitals error:", err);
    return res.status(500).json({ error: "Failed to fetch vital alerts" });
  }
});

// ── POST /api/notifications/expo-token (auth required) ──
// Registers or updates the authenticated user's Expo push token.
app.post("/api/notifications/expo-token", requireAuth(), async (req: any, res) => {
  const { userId } = getAuth(req);
  const { expo_push_token, platform, device_id } = req.body ?? {};

  if (!isExpoPushToken(expo_push_token)) {
    return res.status(400).json({ error: "Valid expo_push_token is required" });
  }

  try {
    await pool.query(
      `INSERT INTO user_push_tokens (user_id, expo_push_token, platform, device_id, enabled)
       VALUES ($1, $2, $3, $4, true)
       ON CONFLICT (expo_push_token)
       DO UPDATE SET
         user_id = EXCLUDED.user_id,
         platform = COALESCE(EXCLUDED.platform, user_push_tokens.platform),
         device_id = COALESCE(EXCLUDED.device_id, user_push_tokens.device_id),
         enabled = true,
         updated_at = NOW()`,
      [userId, expo_push_token, platform ?? null, device_id ?? null],
    );

    return res.json({ success: true });
  } catch (err) {
    console.error("[server] /api/notifications/expo-token error:", err);
    return res.status(500).json({ error: "Failed to register push token" });
  }
});

// ── GET /api/analytics (auth required) ──
// Returns weekly report analytics rows for the authenticated user.
//
// Query params:
//   weeks      -> number of rows to return (default 8, max 52)
//   device_id  -> optional filter by device
//
// Notes:
// - Rows are returned in ascending week order.
// - `notes` is intentionally excluded from the API response.
app.get("/api/analytics", requireAuth(), async (req: any, res) => {
  const { userId } = getAuth(req);
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const parsedWeeks = parseInt((req.query.weeks as string) || "8", 10);
  const weeks = Number.isFinite(parsedWeeks)
    ? Math.max(1, Math.min(parsedWeeks, 52))
    : 8;
  const deviceId =
    typeof req.query.device_id === "string" && req.query.device_id.trim().length > 0
      ? req.query.device_id.trim()
      : null;

  try {
    const params: Array<string | number> = [userId];
    let deviceFilter = "";

    if (deviceId) {
      params.push(deviceId);
      deviceFilter = `AND wr.device_id = $${params.length}`;
    }

    params.push(weeks);
    const limitParamIndex = params.length;

    const result = await pool.query(
      `WITH latest_weeks AS (
         SELECT
           wr.user_id,
           wr.device_id,
           wr.week_start,
           wr.week_end,
           wr.avg_heart_rate_bpm,
           wr.avg_breathing_rate_bpm,
           wr.avg_room_temperature_c,
           wr.avg_room_humidity_rh,
           wr.avg_body_temperature_c,
           wr.total_cry_events,
           wr.total_cry_duration_s,
           wr.longest_cry_duration_s,
           wr.total_sleep_sessions,
           wr.total_sleep_duration_s,
           wr.avg_sleep_duration_s,
           wr.longest_sleep_duration_s,
           wr.total_risky_posture_events,
           wr.created_at
         FROM weekly_reports wr
         WHERE wr.user_id = $1
           ${deviceFilter}
         ORDER BY wr.week_start DESC
         LIMIT $${limitParamIndex}
       )
       SELECT *
       FROM latest_weeks
       ORDER BY week_start ASC`,
      params,
    );
    return res.json({
      weeks: result.rows,
      total_weeks: result.rows.length,
      requested_weeks: weeks,
      device_id: deviceId,
    });
  } catch (err) {
    console.error("[server] /api/analytics error:", err);
    return res.status(500).json({ error: "Failed to fetch analytics" });
  }
});

export async function startServer(): Promise<void> {
  await verifyDatabaseConnection();
  await ensurePushTokenTable();
  await ensureDerivedAlertTables();
  await ensureWeeklyReportsTable();

  app.listen(PORT, () => {
    console.log(`[server] Listening on http://0.0.0.0:${PORT}`);
    console.log(`[server]   GET  /api/readings`);
    console.log(`[server]   POST /api/devices/claim`);
    console.log(`[server]   GET  /api/devices`);
    console.log(`[server]   GET  /api/sensor-data`);
    console.log(`[server]   GET  /api/alerts/cry`);
    console.log(`[server]   GET  /api/alerts/sleep`);
    console.log(`[server]   GET  /api/alerts/risky-posture`);
    console.log(`[server]   GET  /api/alerts/temperature`);
    console.log(`[server]   GET  /api/alerts/vitals`);
    console.log(`[server]   POST /api/notifications/expo-token`);
    console.log(`[server]   GET  /api/analytics?weeks=8&device_id=<optional>`);
  });
}
