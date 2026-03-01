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
  device_id?: string; // Pi device ID (e.g. "waladi-a3f9c2d1")
  data: SensorData;
}

/** Shape of a row returned from the sensor_readings table. */
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
