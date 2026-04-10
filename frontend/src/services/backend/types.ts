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
  device_id?: string; // Pi device ID
  data: SensorData;
}

export interface UserDevice {
  id: number;
  user_id: string;
  device_id: string;
  name: string;
  created_at: string;
}

/** Payload published to camera/snapshot topic */
export interface CameraSnapshotPayload {
  ts: number;
  source: "camera_service";
  data: {
    device_id: string;
    seq: number;
    content_type: "image/jpeg";
    jpeg_b64: string;
    meta: {
      w: number;
      h: number;
      bytes: number;
    };
  };
}
