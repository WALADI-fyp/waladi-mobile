/**
 * MQTT Client — connects to EMQX Cloud over WebSocket (WSS)
 * and subscribes to the `state/baby` topic for live sensor data.
 *
 * Drop-in replacement for the old sseClient.ts.
 * Exposes the same interface: connectToStream(), onNewReading(), getLatestPayload().
 */

import mqtt, { MqttClient } from "mqtt";
import { EMQX_URL, EMQX_USERNAME, EMQX_PASSWORD, MQTT_TOPIC } from "./config";
import { SensorPayload } from "./types";

export type SensorDataCallback = (payload: SensorPayload) => void;
export type ErrorCallback = (error: Error) => void;

let client: MqttClient | null = null;
let latestPayload: SensorPayload | null = null;
const listeners: Set<SensorDataCallback> = new Set();

/** Get the most recently received payload (may be null on cold start). */
export function getLatestPayload(): SensorPayload | null {
  return latestPayload;
}

/**
 * Register a listener that fires on every new MQTT message.
 * Returns an unsubscribe function.
 */
export function onNewReading(fn: SensorDataCallback): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Opens an MQTT WSS connection to EMQX Cloud and subscribes to `state/baby`.
 *
 * @param onData  called with each parsed SensorPayload
 * @param onError called on connection / parse errors
 * @returns disconnect() function to close the connection
 */
export function connectToStream(
  onData: SensorDataCallback,
  onError?: ErrorCallback,
): () => void {
  // Register this caller as a listener
  listeners.add(onData);

  // If already connected, send latest data immediately and return
  if (client && client.connected) {
    if (latestPayload) onData(latestPayload);
    return () => {
      listeners.delete(onData);
    };
  }

  // Connect to EMQX over WSS
  client = mqtt.connect(EMQX_URL, {
    username: EMQX_USERNAME,
    password: EMQX_PASSWORD,
    protocolVersion: 4,
    reconnectPeriod: 3000,
    connectTimeout: 10_000,
    clean: true,
  });

  client.on("connect", () => {
    console.log("[mqtt] Connected to EMQX Cloud");
    client!.subscribe(MQTT_TOPIC, { qos: 0 }, (err) => {
      if (err) {
        console.error("[mqtt] Subscribe error:", err);
        onError?.(err instanceof Error ? err : new Error(String(err)));
      } else {
        console.log(`[mqtt] Subscribed to ${MQTT_TOPIC}`);
      }
    });
  });

  client.on("message", (_topic, message) => {
    try {
      const payload: SensorPayload = JSON.parse(message.toString());
      latestPayload = payload;

      // Broadcast to all listeners
      for (const fn of listeners) {
        fn(payload);
      }
    } catch (err) {
      onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  });

  client.on("error", (err) => {
    console.error("[mqtt] Error:", err.message);
    onError?.(err);
  });

  client.on("reconnect", () => {
    console.log("[mqtt] Reconnecting...");
  });

  client.on("offline", () => {
    console.log("[mqtt] Offline");
  });

  // Return disconnect function
  return () => {
    listeners.delete(onData);
    // Only close if no more listeners
    if (listeners.size === 0 && client) {
      client.end(true);
      client = null;
    }
  };
}

/** Force-disconnect the MQTT client. */
export function disconnect(): void {
  if (client) {
    client.end(true);
    client = null;
  }
  listeners.clear();
  latestPayload = null;
}
