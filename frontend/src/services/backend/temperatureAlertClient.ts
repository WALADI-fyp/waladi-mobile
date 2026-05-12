/**
 * Temperature Alert MQTT Client - subscribes to `waladi/alerts/temperature`
 * and emits parsed temperature-alert events to listeners.
 */

import mqtt, { MqttClient } from "mqtt";
import {
  EMQX_PASSWORD,
  EMQX_URL,
  EMQX_USERNAME,
  TEMPERATURE_ALERT_TOPIC,
} from "./config";
import { TemperatureAlertPayload } from "./types";

export type TemperatureAlertCallback = (payload: TemperatureAlertPayload) => void;
export type ErrorCallback = (error: Error) => void;

let client: MqttClient | null = null;
let latestPayload: TemperatureAlertPayload | null = null;
const listeners: Set<TemperatureAlertCallback> = new Set();

/** Get latest temperature-alert payload (or null). */
export function getLatestTemperatureAlertPayload(): TemperatureAlertPayload | null {
  return latestPayload;
}

/**
 * Connect to EMQX and subscribe to temperature alerts.
 *
 * @returns disconnect function
 */
export function connectToTemperatureAlertStream(
  onData: TemperatureAlertCallback,
  onError?: ErrorCallback,
): () => void {
  listeners.add(onData);

  if (client && client.connected) {
    if (latestPayload) onData(latestPayload);
    return () => {
      listeners.delete(onData);
    };
  }

  client = mqtt.connect(EMQX_URL, {
    username: EMQX_USERNAME,
    password: EMQX_PASSWORD,
    protocolVersion: 4,
    reconnectPeriod: 3000,
    connectTimeout: 10_000,
    clean: true,
    clientId: `waladi_temp_${Math.random().toString(16).slice(2, 8)}`,
  });

  client.on("connect", () => {
    console.log("[temp-alert] Connected to EMQX Cloud");
    client!.subscribe(TEMPERATURE_ALERT_TOPIC, { qos: 0 }, (err) => {
      if (err) {
        console.error("[temp-alert] Subscribe error:", err);
        onError?.(err instanceof Error ? err : new Error(String(err)));
      } else {
        console.log(`[temp-alert] Subscribed to ${TEMPERATURE_ALERT_TOPIC}`);
      }
    });
  });

  client.on("message", (_topic, message) => {
    try {
      const payload: TemperatureAlertPayload = JSON.parse(message.toString());
      latestPayload = payload;

      for (const fn of listeners) {
        fn(payload);
      }
    } catch (err) {
      onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  });

  client.on("error", (err) => {
    console.error("[temp-alert] Error:", err.message);
    onError?.(err);
  });

  client.on("reconnect", () => {
    console.log("[temp-alert] Reconnecting...");
  });

  client.on("offline", () => {
    console.log("[temp-alert] Offline");
  });

  return () => {
    listeners.delete(onData);
    if (listeners.size === 0 && client) {
      client.end(true);
      client = null;
    }
  };
}

/** Force-disconnect the temperature-alert MQTT client. */
export function disconnectTemperatureAlerts(): void {
  if (client) {
    client.end(true);
    client = null;
  }
  listeners.clear();
  latestPayload = null;
}
