/**
 * Camera MQTT Client — subscribes to `camera/snapshot` on EMQX Cloud
 * and exposes base64 JPEG frames to the UI.
 *
 * Reuses the same EMQX broker as mqttClient.ts but on a separate
 * MQTT connection to keep camera traffic isolated from sensor data.
 */

import mqtt, { MqttClient } from "mqtt";
import {
  EMQX_URL,
  EMQX_USERNAME,
  EMQX_PASSWORD,
  CAMERA_TOPIC,
} from "./config";
import { CameraSnapshotPayload } from "./types";

export type FrameCallback = (base64Uri: string, meta: CameraSnapshotPayload["data"]["meta"]) => void;
export type ErrorCallback = (error: Error) => void;

let client: MqttClient | null = null;
let latestFrame: string | null = null;
const listeners: Set<FrameCallback> = new Set();

/** Get the most recent frame as a data URI (or null). */
export function getLatestFrame(): string | null {
  return latestFrame;
}

/**
 * Connect to EMQX and subscribe to `camera/snapshot`.
 * Calls `onFrame` with a base64 data URI every time a new JPEG arrives.
 *
 * @returns disconnect function
 */
export function connectToCameraStream(
  onFrame: FrameCallback,
  onError?: ErrorCallback,
): () => void {
  listeners.add(onFrame);

  // Already connected — send last frame immediately
  if (client && client.connected) {
    if (latestFrame) onFrame(latestFrame, { w: 0, h: 0, bytes: 0 });
    return () => {
      listeners.delete(onFrame);
    };
  }

  client = mqtt.connect(EMQX_URL, {
    username: EMQX_USERNAME,
    password: EMQX_PASSWORD,
    protocolVersion: 4,
    reconnectPeriod: 3000,
    connectTimeout: 10_000,
    clean: true,
    clientId: `waladi_cam_${Math.random().toString(16).slice(2, 8)}`,
  });

  client.on("connect", () => {
    console.log("[camera-mqtt] Connected to EMQX Cloud");
    client!.subscribe(CAMERA_TOPIC, { qos: 0 }, (err) => {
      if (err) {
        console.error("[camera-mqtt] Subscribe error:", err);
        onError?.(err instanceof Error ? err : new Error(String(err)));
      } else {
        console.log(`[camera-mqtt] Subscribed to ${CAMERA_TOPIC}`);
      }
    });
  });

  client.on("message", (_topic, message) => {
    try {
      const payload: CameraSnapshotPayload = JSON.parse(message.toString());
      const b64 = payload.data.jpeg_b64;
      const dataUri = `data:image/jpeg;base64,${b64}`;
      latestFrame = dataUri;

      for (const fn of listeners) {
        fn(dataUri, payload.data.meta);
      }
    } catch (err) {
      onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  });

  client.on("error", (err) => {
    console.error("[camera-mqtt] Error:", err.message);
    onError?.(err);
  });

  client.on("reconnect", () => {
    console.log("[camera-mqtt] Reconnecting...");
  });

  client.on("offline", () => {
    console.log("[camera-mqtt] Offline");
  });

  return () => {
    listeners.delete(onFrame);
    if (listeners.size === 0 && client) {
      client.end(true);
      client = null;
    }
  };
}

/** Force-disconnect the camera MQTT client. */
export function disconnectCamera(): void {
  if (client) {
    client.end(true);
    client = null;
  }
  listeners.clear();
  latestFrame = null;
}
