/**
 * Shared types for WALADI backend.
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
  ts: number;
  source: string;
  device_id?: string;
  data: SensorData;
}

export interface SensorReading {
  time: string;
  source: string;
  heart_rate_bpm: number;
  breathing_rate_bpm: number;
  room_temperature_c: number;
  body_temperature_c: number;
  room_humidity_rh: number;
  mock_fields: string[];
  device_id: string | null;
  user_id: string | null;
}
