/**
 * SSE Ingester — connects to the Pi's SSE stream and persists
 * each sensor payload into the sensor_readings table.
 *
 * Also maintains an in-memory "latest" value so the API can
 * serve it instantly, and broadcasts to connected SSE clients.
 */

import { EventSource } from "eventsource";
import { PI_STREAM_URL } from "./config";
import { pool } from "./db";
import { SensorPayload } from "./types";

/** Callbacks that server.ts registers to push new data to SSE clients. */
type BroadcastFn = (payload: SensorPayload) => void;

let latestPayload: SensorPayload | null = null;
const listeners: Set<BroadcastFn> = new Set();

/** Get the most recently received payload (may be null on cold start). */
export function getLatestPayload(): SensorPayload | null {
  return latestPayload;
}

/** Register a listener that will be called on every new payload. */
export function onNewReading(fn: BroadcastFn): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

const INSERT_SQL = `
  INSERT INTO sensor_readings
    (time, source, heart_rate_bpm, breathing_rate_bpm,
     room_temperature_c, body_temperature_c, room_humidity_rh, mock_fields)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
`;

async function persist(payload: SensorPayload): Promise<void> {
  const { ts, source, data } = payload;
  const time = new Date(ts);
  try {
    await pool.query(INSERT_SQL, [
      time,
      source,
      data.heart_rate_bpm,
      data.breathing_rate_bpm,
      data.room_temperature_c,
      data.body_temperature_c,
      data.room_humidity_rh,
      data.mock_fields ?? [],
    ]);
  } catch (err) {
    console.error("[ingester] DB insert failed:", err);
  }
}

export function startIngester(): void {
  console.log(`[ingester] Connecting to Pi SSE at ${PI_STREAM_URL}`);
  const es = new EventSource(PI_STREAM_URL);

  es.onmessage = (event: MessageEvent) => {
    try {
      const payload: SensorPayload = JSON.parse(event.data);
      latestPayload = payload;

      // Persist to DB
      persist(payload);

      // Broadcast to connected SSE clients
      for (const fn of listeners) {
        fn(payload);
      }
    } catch (err) {
      console.error("[ingester] Parse error:", err);
    }
  };

  es.onerror = (event: any) => {
    console.error(
      "[ingester] SSE error:",
      event?.message || "connection error",
    );
  };

  es.onopen = () => {
    console.log("[ingester] Connected to Pi SSE stream");
  };
}
