/**
 * Types matching the Pi SSE stream payload structure.
 */

export interface SensorData {
  breathing_rate_bpm: number;
  heart_rate_bpm: number;
  room_temperature_c: number;
  body_temperature_c: number;
  room_humidity_rh: number;
  mock_fields: string[];
}

export interface SensorPayload {
  ts: number; // Unix timestamp in milliseconds
  source: string; // Always "fusion_service"
  data: SensorData;
}
