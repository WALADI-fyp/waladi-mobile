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

/** Payload published to waladi/ai/pose topic */
export interface AiPosePayload {
  ts: number;
  source: "ai_pose_service" | string;
  data: {
    device_id: string;
    nose_confidence?: number | null;
    is_risky: boolean;
    face_found?: boolean | null;
    eyes_visible?: number | null;
    baby_state?: string;
    ear?: number | null;
    blanket_flag?: boolean | null;
    burst_activated?: boolean | null;
    burst_false_alarm?: boolean | null;
  };
}

export type SleepAlertEventType = "baby_fell_asleep" | "baby_woke_up";

/** Payload published to waladi/ai/sleep topic */
export interface SleepAlertPayload {
  ts: number;
  source: "sleep_detection_service" | string;
  data: {
    device_id: string;
    baby_state: "awake" | "asleep" | string;
    event: SleepAlertEventType;
    ear?: number | null;
  };
}

export type CryAlertEventType = "cry_start" | "cry_end";

/** Payload published to waladi/alerts/cry topic */
export interface CryAlertPayload {
  event: CryAlertEventType;
  device_id: string;
  prob: number;
  alert_id?: string;
  ts?: number;
}
