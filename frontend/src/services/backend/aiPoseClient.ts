/**
 * AI Pose MQTT Client — subscribes to `waladi/ai/pose`
 * and emits parsed payloads to listeners.
 */

import mqtt, { MqttClient } from "mqtt";
import {
  EMQX_URL,
  EMQX_USERNAME,
  EMQX_PASSWORD,
  AI_POSE_TOPIC,
} from "./config";
import { AiPosePayload } from "./types";

export type AiPoseCallback = (payload: AiPosePayload) => void;
export type ErrorCallback = (error: Error) => void;

let client: MqttClient | null = null;
let latestPayload: AiPosePayload | null = null;
const listeners: Set<AiPoseCallback> = new Set();

/** Get latest AI pose payload (or null). */
export function getLatestAiPosePayload(): AiPosePayload | null {
  return latestPayload;
}

/**
 * Connect to EMQX and subscribe to `waladi/ai/pose`.
 *
 * @returns disconnect function
 */
export function connectToAiPoseStream(
  onData: AiPoseCallback,
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
    clientId: `waladi_ai_pose_${Math.random().toString(16).slice(2, 8)}`,
  });

  client.on("connect", () => {
    console.log("[ai-pose] Connected to EMQX Cloud");
    client!.subscribe(AI_POSE_TOPIC, { qos: 0 }, (err) => {
      if (err) {
        console.error("[ai-pose] Subscribe error:", err);
        onError?.(err instanceof Error ? err : new Error(String(err)));
      } else {
        console.log(`[ai-pose] Subscribed to ${AI_POSE_TOPIC}`);
      }
    });
  });

  client.on("message", (_topic, message) => {
    try {
      const payload: AiPosePayload = JSON.parse(message.toString());
      latestPayload = payload;

      for (const fn of listeners) {
        fn(payload);
      }
    } catch (err) {
      onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  });

  client.on("error", (err) => {
    console.error("[ai-pose] Error:", err.message);
    onError?.(err);
  });

  client.on("reconnect", () => {
    console.log("[ai-pose] Reconnecting...");
  });

  client.on("offline", () => {
    console.log("[ai-pose] Offline");
  });

  return () => {
    listeners.delete(onData);
    if (listeners.size === 0 && client) {
      client.end(true);
      client = null;
    }
  };
}

/** Force-disconnect the AI pose MQTT client. */
export function disconnectAiPose(): void {
  if (client) {
    client.end(true);
    client = null;
  }
  listeners.clear();
  latestPayload = null;
}
