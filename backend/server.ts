/**
 * Express server — exposes sensor data via REST + SSE.
 *
 * Endpoints:
 *   GET /api/readings/latest    → most recent sensor reading
 *   GET /api/readings           → historical readings (query params: from, to, limit)
 *   GET /api/stream             → SSE stream that re-broadcasts Pi data
 */

import express from "express";
import cors from "cors";
import { PORT } from "./config";
import { pool } from "./db";
import { getLatestPayload, onNewReading } from "./ingester";

const app = express();
app.use(cors());
app.use(express.json());

// ── GET /api/readings/latest ──
app.get("/api/readings/latest", (_req, res) => {
  const latest = getLatestPayload();
  if (!latest) {
    return res.status(204).json({ message: "No data yet" });
  }
  return res.json(latest);
});

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
             room_temperature_c, body_temperature_c, room_humidity_rh, mock_fields
      FROM sensor_readings
    `;
    const params: any[] = [];
    const conditions: string[] = [];

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

// ── GET /api/stream (SSE) ──
app.get("/api/stream", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });

  // Send latest data immediately so client doesn't start blank
  const latest = getLatestPayload();
  if (latest) {
    res.write(`data: ${JSON.stringify(latest)}\n\n`);
  }

  // Subscribe to new readings
  const unsubscribe = onNewReading((payload) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  });

  // Keep-alive heartbeat every 15s
  const heartbeat = setInterval(() => {
    res.write(":heartbeat\n\n");
  }, 15_000);

  req.on("close", () => {
    unsubscribe();
    clearInterval(heartbeat);
  });
});

export function startServer(): void {
  app.listen(PORT, () => {
    console.log(`[server] Listening on http://0.0.0.0:${PORT}`);
    console.log(`[server]   GET /api/readings/latest`);
    console.log(`[server]   GET /api/readings?from=&to=&limit=`);
    console.log(`[server]   GET /api/stream (SSE)`);
  });
}
