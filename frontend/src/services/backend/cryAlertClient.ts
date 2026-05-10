/**
 * Cry Alert MQTT Client - subscribes to `waladi/alerts/cry`
 * and emits parsed cry events to listeners.
 */

import mqtt, { MqttClient } from "mqtt";
import {
  CRY_ALERT_TOPIC,
  EMQX_PASSWORD,
  EMQX_URL,
  EMQX_USERNAME,
} from "./config";
import { CryAlertPayload } from "./types";

export type CryAlertCallback = (payload: CryAlertPayload) => void;
export type ErrorCallback = (error: Error) => void;

let client: MqttClient | null = null;
let latestPayload: CryAlertPayload | null = null;
const listeners: Set<CryAlertCallback> = new Set();

/** Get latest cry-alert payload (or null). */
export function getLatestCryAlertPayload(): CryAlertPayload | null {
  return latestPayload;
}

/**
 * Connect to EMQX and subscribe to cry alerts.
 *
 * @returns disconnect function
 */
export function connectToCryAlertStream(
  onData: CryAlertCallback,
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
    clientId: `waladi_cry_${Math.random().toString(16).slice(2, 8)}`,
  });

  client.on("connect", () => {
    console.log("[cry-alert] Connected to EMQX Cloud");
    client!.subscribe(CRY_ALERT_TOPIC, { qos: 0 }, (err) => {
      if (err) {
        console.error("[cry-alert] Subscribe error:", err);
        onError?.(err instanceof Error ? err : new Error(String(err)));
      } else {
        console.log(`[cry-alert] Subscribed to ${CRY_ALERT_TOPIC}`);
      }
    });
  });

  client.on("message", (_topic, message) => {
    try {
      const payload: CryAlertPayload = JSON.parse(message.toString());
      latestPayload = payload;

      for (const fn of listeners) {
        fn(payload);
      }
    } catch (err) {
      onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  });

  client.on("error", (err) => {
    console.error("[cry-alert] Error:", err.message);
    onError?.(err);
  });

  client.on("reconnect", () => {
    console.log("[cry-alert] Reconnecting...");
  });

  client.on("offline", () => {
    console.log("[cry-alert] Offline");
  });

  return () => {
    listeners.delete(onData);
    if (listeners.size === 0 && client) {
      client.end(true);
      client = null;
    }
  };
}

/** Force-disconnect the cry-alert MQTT client. */
export function disconnectCryAlerts(): void {
  if (client) {
    client.end(true);
    client = null;
  }
  listeners.clear();
  latestPayload = null;
}
