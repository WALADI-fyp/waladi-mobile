/**
 * Sensor Service
 *
 * Frontend-facing wrapper around the backend SSE client.
 * Screens and hooks import from here instead of reaching into `../../backend/`.
 */

export { connectToStream } from "./backend/sseClient";
export type { SensorDataCallback, ErrorCallback } from "./backend/sseClient";
export type { SensorPayload, SensorData } from "./backend/types";
