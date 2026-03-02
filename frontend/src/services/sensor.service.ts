/**
 * Sensor Service
 *
 * Frontend-facing wrapper around the MQTT client.
 * Screens and hooks import from here instead of reaching into `./backend/`.
 */

export { connectToStream, getLatestPayload, disconnect } from "./backend/mqttClient";
export type { SensorDataCallback, ErrorCallback } from "./backend/mqttClient";
export type { SensorPayload, SensorData } from "./backend/types";
