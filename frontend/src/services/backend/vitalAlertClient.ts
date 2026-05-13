/**
 * Vital Alert MQTT Client - subscribes to `waladi/alerts/vitals`
 * and emits parsed vital-alert events to listeners.
 */

import mqtt, { MqttClient } from "mqtt";
import {
  EMQX_PASSWORD,
  EMQX_URL,
  EMQX_USERNAME,
  VITAL_ALERT_TOPIC,
} from "./config";
import { VitalAlertPayload } from "./types";

export type VitalAlertCallback = (payload: VitalAlertPayload) => void;
export type ErrorCallback = (error: Error) => void;

let client: MqttClient | null = null;
let latestPayload: VitalAlertPayload | null = null;
const listeners: Set<VitalAlertCallback> = new Set();

/** Get latest vital-alert payload (or null). */
export function getLatestVitalAlertPayload(): VitalAlertPayload | null {
  return latestPayload;
}

/**
 * Connect to EMQX and subscribe to vital alerts.
 *
 * @returns disconnect function
 */
export function connectToVitalAlertStream(
  onData: VitalAlertCallback,
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
    clientId: `waladi_vital_${Math.random().toString(16).slice(2, 8)}`,
  });

  client.on("connect", () => {
    console.log("[vital-alert] Connected to EMQX Cloud");
    client!.subscribe(VITAL_ALERT_TOPIC, { qos: 0 }, (err) => {
      if (err) {
        console.error("[vital-alert] Subscribe error:", err);
        onError?.(err instanceof Error ? err : new Error(String(err)));
      } else {
        console.log(`[vital-alert] Subscribed to ${VITAL_ALERT_TOPIC}`);
      }
    });
  });

  client.on("message", (_topic, message) => {
    try {
      const payload: VitalAlertPayload = JSON.parse(message.toString());
      latestPayload = payload;

      for (const fn of listeners) {
        fn(payload);
      }
    } catch (err) {
      onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  });

  client.on("error", (err) => {
    console.error("[vital-alert] Error:", err.message);
    onError?.(err);
  });

  client.on("reconnect", () => {
    console.log("[vital-alert] Reconnecting...");
  });

  client.on("offline", () => {
    console.log("[vital-alert] Offline");
  });

  return () => {
    listeners.delete(onData);
    if (listeners.size === 0 && client) {
      client.end(true);
      client = null;
    }
  };
}

/** Force-disconnect the vital-alert MQTT client. */
export function disconnectVitalAlerts(): void {
  if (client) {
    client.end(true);
    client = null;
  }
  listeners.clear();
  latestPayload = null;
}
