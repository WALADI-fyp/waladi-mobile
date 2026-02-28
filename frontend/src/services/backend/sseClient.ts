/**
 * SSE Client for connecting to the WALDI backend stream.
 *
 * Uses react-native-sse (an EventSource polyfill for React Native).
 * Connects to the backend server which re-broadcasts Pi sensor data.
 */

import EventSource from "react-native-sse";
import { STREAM_URL } from "./config";
import { SensorPayload } from "./types";

export type SensorDataCallback = (payload: SensorPayload) => void;
export type ErrorCallback = (error: Error) => void;

/**
 * Opens an SSE connection to the backend stream endpoint.
 *
 * @param onData  called with each parsed SensorPayload (~1/sec)
 * @param onError called when the connection errors
 * @returns disconnect() function to close the connection
 */
export function connectToStream(
  onData: SensorDataCallback,
  onError?: ErrorCallback,
): () => void {
  const es = new EventSource(STREAM_URL);

  es.addEventListener("message", (event: any) => {
    try {
      const raw = typeof event === "string" ? event : event?.data;
      if (!raw) return;

      const payload: SensorPayload = JSON.parse(raw);
      onData(payload);
    } catch (err) {
      onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  });

  es.addEventListener("error", (event: any) => {
    const message = event?.message || event?.data || "SSE connection error";
    onError?.(new Error(message));
  });

  return () => {
    es.close();
  };
}
