/**
 * Sleep Alert MQTT Client - subscribes to `waladi/ai/sleep`
 * and emits parsed sleep events to listeners.
 */

import mqtt, { MqttClient } from "mqtt";
import {
  EMQX_PASSWORD,
  EMQX_URL,
  EMQX_USERNAME,
  SLEEP_ALERT_TOPIC,
} from "./config";
import { SleepAlertPayload } from "./types";

export type SleepAlertCallback = (payload: SleepAlertPayload) => void;
export type ErrorCallback = (error: Error) => void;

let client: MqttClient | null = null;
let latestPayload: SleepAlertPayload | null = null;
const listeners: Set<SleepAlertCallback> = new Set();

/** Get latest sleep-alert payload (or null). */
export function getLatestSleepAlertPayload(): SleepAlertPayload | null {
  return latestPayload;
}

/**
 * Connect to EMQX and subscribe to sleep alerts.
 *
 * @returns disconnect function
 */
export function connectToSleepAlertStream(
  onData: SleepAlertCallback,
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
    clientId: `waladi_sleep_${Math.random().toString(16).slice(2, 8)}`,
  });

  client.on("connect", () => {
    console.log("[sleep-alert] Connected to EMQX Cloud");
    client!.subscribe(SLEEP_ALERT_TOPIC, { qos: 0 }, (err) => {
      if (err) {
        console.error("[sleep-alert] Subscribe error:", err);
        onError?.(err instanceof Error ? err : new Error(String(err)));
      } else {
        console.log(`[sleep-alert] Subscribed to ${SLEEP_ALERT_TOPIC}`);
      }
    });
  });

  client.on("message", (_topic, message) => {
    try {
      const payload: SleepAlertPayload = JSON.parse(message.toString());
      latestPayload = payload;

      for (const fn of listeners) {
        fn(payload);
      }
    } catch (err) {
      onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  });

  client.on("error", (err) => {
    console.error("[sleep-alert] Error:", err.message);
    onError?.(err);
  });

  client.on("reconnect", () => {
    console.log("[sleep-alert] Reconnecting...");
  });

  client.on("offline", () => {
    console.log("[sleep-alert] Offline");
  });

  return () => {
    listeners.delete(onData);
    if (listeners.size === 0 && client) {
      client.end(true);
      client = null;
    }
  };
}

/** Force-disconnect the sleep-alert MQTT client. */
export function disconnectSleepAlerts(): void {
  if (client) {
    client.end(true);
    client = null;
  }
  listeners.clear();
  latestPayload = null;
}
