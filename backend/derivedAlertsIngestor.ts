import { randomUUID } from "crypto";
import {
  AI_POSE_TOPIC,
  EMQX_PASSWORD,
  EMQX_URL,
  EMQX_USERNAME,
  SLEEP_ALERT_TOPIC,
} from "./config";
import { pool } from "./db";

type MqttClientLike = {
  on: (event: string, callback: (...args: any[]) => void) => void;
  subscribe: (
    topic: string | string[],
    options: { qos: number },
    callback: (err?: Error | null) => void,
  ) => void;
  end: (force?: boolean) => void;
};

type MqttModuleLike = {
  connect: (
    brokerUrl: string,
    options: Record<string, unknown>,
  ) => MqttClientLike;
};

interface SleepPayload {
  ts?: number;
  source?: string;
  data?: {
    device_id?: string;
    baby_state?: string;
    event?: "baby_fell_asleep" | "baby_woke_up" | string;
    ear?: number | null;
  };
}

interface PosePayload {
  ts?: number;
  source?: string;
  data?: {
    device_id?: string;
    is_risky?: boolean;
    nose_confidence?: number | null;
    face_found?: boolean | null;
    eyes_visible?: number | null;
  };
}

interface ActiveSleepSession {
  alertId: string;
  startedAt: Date;
  earStart: number | null;
}

let mqttClient: MqttClientLike | null = null;
let started = false;
let mqttUnavailableLogged = false;

const activeSleepByDevice = new Map<string, ActiveSleepSession>();
const riskyStateByDevice = new Map<string, boolean>();

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function parseDateFromTs(ts: unknown): Date {
  if (typeof ts === "number" && Number.isFinite(ts)) {
    const d = new Date(ts);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

function safeDeviceId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  return value.length > 0 ? value : null;
}

function loadMqttModule(): MqttModuleLike | null {
  try {
    // Keep this dynamic so backend still compiles even before dependency install.
    return require("mqtt") as MqttModuleLike;
  } catch (err) {
    if (!mqttUnavailableLogged) {
      mqttUnavailableLogged = true;
      console.error(
        "[ingestor] MQTT dependency missing. Install backend dependency `mqtt` and redeploy.",
      );
      console.error("[ingestor] MQTT load error:", err);
    }
    return null;
  }
}

async function resolveUserIdsForDevice(deviceId: string): Promise<string[]> {
  const result = await pool.query<{ user_id: string }>(
    `SELECT DISTINCT user_id
     FROM user_devices
     WHERE device_id = $1`,
    [deviceId],
  );
  return result.rows.map((r) => r.user_id).filter(Boolean);
}

async function loadActiveSleepBaseline(): Promise<void> {
  const result = await pool.query<{
    device_id: string;
    alert_id: string;
    started_at: string | Date;
    ear_start: number | null;
  }>(
    `SELECT DISTINCT ON (device_id)
        device_id,
        alert_id,
        started_at,
        ear_start
     FROM sleep_alerts
     WHERE ended_at IS NULL
     ORDER BY device_id, started_at DESC`,
  );

  for (const row of result.rows) {
    const startedAt = new Date(row.started_at);
    if (Number.isNaN(startedAt.getTime())) continue;

    activeSleepByDevice.set(row.device_id, {
      alertId: row.alert_id,
      startedAt,
      earStart: row.ear_start ?? null,
    });
  }

  if (result.rows.length > 0) {
    console.log(
      `[ingestor] Restored ${result.rows.length} active sleep session(s) from DB`,
    );
  }
}

async function persistSleepStart(payload: SleepPayload): Promise<void> {
  const data = payload.data;
  if (!data || data.event !== "baby_fell_asleep") return;

  const deviceId = safeDeviceId(data.device_id);
  if (!deviceId) return;

  if (activeSleepByDevice.has(deviceId)) {
    return;
  }

  const startedAt = parseDateFromTs(payload.ts);
  const earStart = parseNumber(data.ear);
  const alertId = `sleep_${deviceId}_${startedAt.getTime()}_${randomUUID().slice(0, 8)}`;

  const userIds = await resolveUserIdsForDevice(deviceId);
  for (const userId of userIds) {
    await pool.query(
      `INSERT INTO sleep_alerts (
         alert_id, user_id, device_id, started_at, ear_start, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       ON CONFLICT (alert_id, user_id)
       DO NOTHING`,
      [alertId, userId, deviceId, startedAt.toISOString(), earStart],
    );
  }

  activeSleepByDevice.set(deviceId, { alertId, startedAt, earStart });
  console.log(
    `[ingestor] Sleep start persisted for ${deviceId} (${userIds.length} user(s))`,
  );
}

async function loadLatestOpenSleepSession(
  deviceId: string,
): Promise<ActiveSleepSession | null> {
  const result = await pool.query<{
    alert_id: string;
    started_at: string | Date;
    ear_start: number | null;
  }>(
    `SELECT alert_id, started_at, ear_start
     FROM sleep_alerts
     WHERE device_id = $1
       AND ended_at IS NULL
     ORDER BY started_at DESC
     LIMIT 1`,
    [deviceId],
  );

  const row = result.rows[0];
  if (!row) return null;

  const startedAt = new Date(row.started_at);
  if (Number.isNaN(startedAt.getTime())) return null;

  return {
    alertId: row.alert_id,
    startedAt,
    earStart: row.ear_start ?? null,
  };
}

async function persistSleepEnd(payload: SleepPayload): Promise<void> {
  const data = payload.data;
  if (!data || data.event !== "baby_woke_up") return;

  const deviceId = safeDeviceId(data.device_id);
  if (!deviceId) return;

  let session = activeSleepByDevice.get(deviceId) ?? null;
  if (!session) {
    session = await loadLatestOpenSleepSession(deviceId);
    if (!session) {
      return;
    }
  }

  const endedAt = parseDateFromTs(payload.ts);
  const durationSeconds = Math.max(
    0,
    (endedAt.getTime() - session.startedAt.getTime()) / 1000,
  );
  const earEnd = parseNumber(data.ear);

  const userIds = await resolveUserIdsForDevice(deviceId);
  for (const userId of userIds) {
    await pool.query(
      `UPDATE sleep_alerts
       SET ended_at = $1,
           duration_s = $2,
           ear_end = $3,
           updated_at = NOW()
       WHERE alert_id = $4
         AND user_id = $5
         AND ended_at IS NULL`,
      [
        endedAt.toISOString(),
        durationSeconds,
        earEnd,
        session.alertId,
        userId,
      ],
    );
  }

  activeSleepByDevice.delete(deviceId);
  console.log(
    `[ingestor] Sleep end persisted for ${deviceId} (${userIds.length} user(s))`,
  );
}

async function persistRiskyPostureEvent(payload: PosePayload): Promise<void> {
  const data = payload.data;
  if (!data) return;

  const deviceId = safeDeviceId(data.device_id);
  if (!deviceId) return;

  const isRisky = data.is_risky === true;
  const previous = riskyStateByDevice.get(deviceId);
  riskyStateByDevice.set(deviceId, isRisky);

  // One-shot alert behavior: save only when transitioning into risky.
  if (!isRisky || previous === true) {
    return;
  }

  // Avoid creating a synthetic alert if we never saw a prior state yet.
  if (previous === undefined) {
    return;
  }

  const detectedAt = parseDateFromTs(payload.ts);
  const alertId = `risk_${deviceId}_${detectedAt.getTime()}_${randomUUID().slice(0, 8)}`;
  const noseConfidence = parseNumber(data.nose_confidence);
  const faceFound =
    typeof data.face_found === "boolean" ? data.face_found : null;
  const eyesVisibleRaw = parseNumber(data.eyes_visible);
  const eyesVisible =
    eyesVisibleRaw !== null ? Math.max(0, Math.round(eyesVisibleRaw)) : null;

  const userIds = await resolveUserIdsForDevice(deviceId);
  for (const userId of userIds) {
    await pool.query(
      `INSERT INTO risky_posture_alerts (
         alert_id,
         user_id,
         device_id,
         detected_at,
         nose_confidence,
         face_found,
         eyes_visible,
         created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (alert_id, user_id)
       DO NOTHING`,
      [
        alertId,
        userId,
        deviceId,
        detectedAt.toISOString(),
        noseConfidence,
        faceFound,
        eyesVisible,
      ],
    );
  }

  console.log(
    `[ingestor] Risky posture persisted for ${deviceId} (${userIds.length} user(s))`,
  );
}

async function handleSleepMessage(parsed: SleepPayload): Promise<void> {
  await persistSleepStart(parsed);
  await persistSleepEnd(parsed);
}

async function handlePoseMessage(parsed: PosePayload): Promise<void> {
  await persistRiskyPostureEvent(parsed);
}

function topicMatches(topic: string, expected: string): boolean {
  return topic.trim() === expected.trim();
}

export async function startDerivedAlertsIngestor(): Promise<void> {
  if (started) return;

  const mqtt = loadMqttModule();
  if (!mqtt) return;

  await loadActiveSleepBaseline();

  mqttClient = mqtt.connect(EMQX_URL, {
    username: EMQX_USERNAME,
    password: EMQX_PASSWORD,
    protocolVersion: 4,
    reconnectPeriod: 3000,
    connectTimeout: 10_000,
    clean: true,
    clientId: `waladi_backend_alerts_${Math.random().toString(16).slice(2, 10)}`,
  });

  mqttClient.on("connect", () => {
    console.log("[ingestor] Connected to EMQX Cloud");
    mqttClient?.subscribe([SLEEP_ALERT_TOPIC, AI_POSE_TOPIC], { qos: 0 }, (err) => {
      if (err) {
        console.error("[ingestor] Subscribe error:", err);
      } else {
        console.log(
          `[ingestor] Subscribed to ${SLEEP_ALERT_TOPIC} and ${AI_POSE_TOPIC}`,
        );
      }
    });
  });

  mqttClient.on("message", (topic: string, message: Buffer) => {
    const raw = message.toString();
    try {
      if (topicMatches(topic, SLEEP_ALERT_TOPIC)) {
        const parsed = JSON.parse(raw) as SleepPayload;
        handleSleepMessage(parsed).catch((err) => {
          console.error("[ingestor] Failed handling sleep message:", err);
        });
        return;
      }

      if (topicMatches(topic, AI_POSE_TOPIC)) {
        const parsed = JSON.parse(raw) as PosePayload;
        handlePoseMessage(parsed).catch((err) => {
          console.error("[ingestor] Failed handling pose message:", err);
        });
      }
    } catch (err) {
      console.error("[ingestor] Failed to parse MQTT payload:", err);
    }
  });

  mqttClient.on("error", (err: Error) => {
    console.error("[ingestor] MQTT error:", err.message);
  });

  mqttClient.on("reconnect", () => {
    console.log("[ingestor] Reconnecting to EMQX...");
  });

  mqttClient.on("offline", () => {
    console.log("[ingestor] MQTT offline");
  });

  started = true;
  console.log("[ingestor] Derived alerts ingestor started");
}

export function stopDerivedAlertsIngestor(): void {
  if (mqttClient) {
    mqttClient.end(true);
    mqttClient = null;
  }
  started = false;
}
