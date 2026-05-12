import https from "https";
import { pool } from "./db";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const POLL_INTERVAL_MS = 5000;
const LOOKBACK_WINDOW = "2 hours";

const seenCryStartSessions = new Set<string>();
const seenCryEndSessions = new Set<string>();
const crySessionStartMs = new Map<string, number>();
let cryBaselineInitialized = false;

const seenSleepStartSessions = new Set<string>();
const seenSleepEndSessions = new Set<string>();
const sleepSessionStartMs = new Map<string, number>();
let sleepBaselineInitialized = false;

const seenRiskyPostureAlerts = new Set<string>();
let riskyBaselineInitialized = false;

const seenTemperatureAlerts = new Set<string>();
let temperatureBaselineInitialized = false;

let pollTimer: NodeJS.Timeout | null = null;

function parseString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  return v.length > 0 ? v : null;
}

function parseIdentifier(value: unknown): string | null {
  const asString = parseString(value);
  if (asString) return asString;

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function parseDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "number" && Number.isFinite(value)) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value !== "string" || value.length === 0) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDuration(seconds: number): string {
  return `${seconds.toFixed(3)}s`;
}

function formatSleepDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;

  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatProb(prob: number | null): string | null {
  if (prob === null) return null;
  return `${Math.round(prob * 100)}% confidence`;
}

function getDeviceId(row: Record<string, unknown>): string | null {
  return parseString(row.device_id) ?? parseString(row.deviceId);
}

function getSessionKey(
  row: Record<string, unknown>,
  startedAt: Date,
  prefix: string,
): string {
  const alertId = parseString(row.alert_id) ?? parseString(row.alertId);
  if (alertId) return `${prefix}:alert:${alertId}`;

  const deviceId = getDeviceId(row) ?? "unknown-device";
  return `${prefix}:device:${deviceId}:start:${startedAt.toISOString()}`;
}

function getRiskyKey(row: Record<string, unknown>, detectedAt: Date): string {
  const alertId = parseString(row.alert_id) ?? parseString(row.alertId);
  if (alertId) return `risk:alert:${alertId}`;

  const deviceId = getDeviceId(row) ?? "unknown-device";
  return `risk:device:${deviceId}:detected:${detectedAt.toISOString()}`;
}

type TemperatureSeverity =
  | "normal_high"
  | "moderately_high"
  | "severe";

function classifyTemperatureSeverity(
  temperatureC: number,
): TemperatureSeverity | null {
  if (temperatureC <= 37.0) return null;
  if (temperatureC <= 37.5) return "normal_high";
  if (temperatureC <= 38.0) return "moderately_high";
  return "severe";
}

function parseTemperatureSeverity(
  severityRaw: unknown,
  temperatureC: number | null,
): TemperatureSeverity | null {
  if (
    severityRaw === "normal_high" ||
    severityRaw === "moderately_high" ||
    severityRaw === "severe"
  ) {
    return severityRaw;
  }

  if (temperatureC === null) return null;
  return classifyTemperatureSeverity(temperatureC);
}

function getTemperatureAlertKey(
  row: Record<string, unknown>,
  createdAt: Date,
): string {
  const alertId = parseIdentifier(row.alert_id) ?? parseIdentifier(row.alertId);
  if (alertId) return `temp:alert:${alertId}`;

  const rowId = parseIdentifier(row.id);
  if (rowId) return `temp:id:${rowId}`;

  const deviceId = getDeviceId(row) ?? "unknown-device";
  const temperature = parseNumber(row.temperature_c) ?? parseNumber(row.temperatureC) ?? -999;
  return `temp:device:${deviceId}:created:${createdAt.toISOString()}:value:${temperature.toFixed(3)}`;
}

function toJson(
  value: unknown,
): value is { data?: Array<{ status?: string; message?: string }> } {
  return typeof value === "object" && value !== null;
}

async function postExpoPush(messages: unknown[]): Promise<void> {
  const body = JSON.stringify(messages);

  await new Promise<void>((resolve, reject) => {
    const req = https.request(
      EXPO_PUSH_URL,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        let chunks = "";
        res.on("data", (chunk) => {
          chunks += chunk.toString();
        });
        res.on("end", () => {
          if ((res.statusCode ?? 500) >= 400) {
            return reject(
              new Error(
                `[push] Expo API ${res.statusCode}: ${chunks.slice(0, 500)}`,
              ),
            );
          }

          try {
            const parsed = chunks ? JSON.parse(chunks) : {};
            if (!toJson(parsed)) {
              resolve();
              return;
            }

            const errored = parsed.data?.filter((item) => item?.status === "error");
            if (errored && errored.length > 0) {
              console.warn("[push] Some Expo push tickets failed:", errored);
            }
            resolve();
          } catch {
            resolve();
          }
        });
      },
    );

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function resolveUserIds(row: Record<string, unknown>): Promise<string[]> {
  const userId = parseString(row.user_id) ?? parseString(row.userId);
  if (userId) return [userId];

  const deviceId = getDeviceId(row);
  if (!deviceId) return [];

  const result = await pool.query<{ user_id: string }>(
    `SELECT DISTINCT user_id
     FROM user_devices
     WHERE device_id = $1`,
    [deviceId],
  );
  return result.rows.map((r) => r.user_id).filter(Boolean);
}

async function resolveTokensForUsers(userIds: string[]): Promise<string[]> {
  if (userIds.length === 0) return [];

  const result = await pool.query<{ expo_push_token: string }>(
    `SELECT DISTINCT expo_push_token
     FROM user_push_tokens
     WHERE user_id = ANY($1::text[])
       AND enabled = true`,
    [userIds],
  );

  return result.rows
    .map((r) => r.expo_push_token)
    .filter(
      (token) =>
        token.startsWith("ExponentPushToken[") ||
        token.startsWith("ExpoPushToken["),
    );
}

async function sendPushForUsers(
  userIds: string[],
  buildMessage: (to: string) => unknown,
): Promise<void> {
  const tokens = await resolveTokensForUsers(userIds);
  if (tokens.length === 0) return;
  const messages = tokens.map((to) => buildMessage(to));
  await postExpoPush(messages);
}

async function pushCryStart(row: Record<string, unknown>, sessionKey: string) {
  const userIds = await resolveUserIds(row);
  if (userIds.length === 0) return;

  const prob = parseNumber(row.prob_start) ?? parseNumber(row.prob);
  const probText = formatProb(prob);
  const body = probText
    ? `Baby started crying (${probText}).`
    : "Baby started crying.";

  await sendPushForUsers(userIds, (to) => ({
    to,
    sound: "default",
    title: "Crying detected",
    body,
    priority: "high",
    data: {
      type: "cry_start",
      session_key: sessionKey,
      device_id: getDeviceId(row),
    },
  }));
}

async function pushCryEnd(
  row: Record<string, unknown>,
  sessionKey: string,
  startedAt: Date,
  endedAt: Date,
) {
  const userIds = await resolveUserIds(row);
  if (userIds.length === 0) return;

  const dbDuration =
    parseNumber(row.duration_s) ??
    parseNumber(row.duration_sec) ??
    parseNumber(row.duration_seconds);
  const durationSeconds =
    dbDuration !== null
      ? Math.max(0, dbDuration)
      : Math.max(0, (endedAt.getTime() - startedAt.getTime()) / 1000);
  const title = `Crying detected (${formatDuration(durationSeconds)})`;
  const prob = parseNumber(row.prob_end);
  const probText = formatProb(prob);
  const body = probText
    ? `Baby stopped crying (${probText}).`
    : "Baby stopped crying.";

  await sendPushForUsers(userIds, (to) => ({
    to,
    sound: "default",
    title,
    body,
    priority: "high",
    data: {
      type: "cry_end",
      session_key: sessionKey,
      device_id: getDeviceId(row),
      duration_seconds: durationSeconds,
    },
  }));
}

async function pushSleepStart(row: Record<string, unknown>, sessionKey: string) {
  const userIds = await resolveUserIds(row);
  if (userIds.length === 0) return;

  const body = "Baby fell asleep.";

  await sendPushForUsers(userIds, (to) => ({
    to,
    sound: "default",
    title: "Sleep update",
    body,
    priority: "high",
    data: {
      type: "sleep_start",
      session_key: sessionKey,
      device_id: getDeviceId(row),
    },
  }));
}

async function pushSleepEnd(
  row: Record<string, unknown>,
  sessionKey: string,
  startedAt: Date,
  endedAt: Date,
) {
  const userIds = await resolveUserIds(row);
  if (userIds.length === 0) return;

  const dbDuration =
    parseNumber(row.duration_s) ??
    parseNumber(row.duration_sec) ??
    parseNumber(row.duration_seconds);
  const durationSeconds =
    dbDuration !== null
      ? Math.max(0, dbDuration)
      : Math.max(0, (endedAt.getTime() - startedAt.getTime()) / 1000);

  await sendPushForUsers(userIds, (to) => ({
    to,
    sound: "default",
    title: "Sleep update",
    body: `Baby woke up (slept ${formatSleepDuration(durationSeconds)}).`,
    priority: "high",
    data: {
      type: "sleep_end",
      session_key: sessionKey,
      device_id: getDeviceId(row),
      duration_seconds: durationSeconds,
    },
  }));
}

async function pushRiskyPostureAlert(
  row: Record<string, unknown>,
  alertKey: string,
) {
  const userIds = await resolveUserIds(row);
  if (userIds.length === 0) return;

  await sendPushForUsers(userIds, (to) => ({
    to,
    sound: "default",
    title: "Risky posture detected",
    body: "Risky posture detected. Please check your baby.",
    priority: "high",
    data: {
      type: "risky_posture",
      alert_key: alertKey,
      device_id: getDeviceId(row),
    },
  }));
}

async function pushTemperatureAlert(
  row: Record<string, unknown>,
  alertKey: string,
) {
  const userIds = await resolveUserIds(row);
  if (userIds.length === 0) return;

  const temperatureC = parseNumber(row.temperature_c) ?? parseNumber(row.temperatureC);
  const severity = parseTemperatureSeverity(row.severity, temperatureC);
  if (severity === null || temperatureC === null) return;

  let title = "Temperature alert";
  let body = `Body temperature is ${temperatureC.toFixed(1)}°C.`;
  let priority: "default" | "high" = "high";

  if (severity === "normal_high") {
    title = "Temperature slightly high";
    body = `Body temperature is ${temperatureC.toFixed(1)}°C. Monitor closely.`;
    priority = "default";
  } else if (severity === "moderately_high") {
    title = "Temperature moderately high";
    body = `Body temperature is ${temperatureC.toFixed(1)}°C. Please check on your baby.`;
  } else if (severity === "severe") {
    title = "Severe temperature alert";
    body = `Body temperature is ${temperatureC.toFixed(1)}°C. Please check immediately.`;
  }

  await sendPushForUsers(userIds, (to) => ({
    to,
    sound: "default",
    title,
    body,
    priority,
    data: {
      type: "temperature_alert",
      alert_key: alertKey,
      device_id: getDeviceId(row),
      temperature_c: temperatureC,
      severity,
    },
  }));
}

async function pollCryAlertsForPush(): Promise<void> {
  const result = await pool.query(
    `SELECT *
     FROM cry_alerts
     WHERE started_at >= NOW() - $1::interval
     ORDER BY started_at ASC
     LIMIT 500`,
    [LOOKBACK_WINDOW],
  );

  const rows = result.rows as Record<string, unknown>[];
  if (!cryBaselineInitialized) {
    for (const row of rows) {
      const startedAt =
        parseDate(row.started_at) ??
        parseDate(row.startedAt) ??
        parseDate(row.created_at);
      if (!startedAt) continue;

      const sessionKey = getSessionKey(row, startedAt, "cry");
      seenCryStartSessions.add(sessionKey);
      crySessionStartMs.set(sessionKey, startedAt.getTime());

      const endedAt = parseDate(row.ended_at) ?? parseDate(row.endedAt);
      if (endedAt) {
        seenCryEndSessions.add(sessionKey);
      }
    }

    cryBaselineInitialized = true;
    console.log("[push] Cry push baseline initialized");
    return;
  }

  for (const row of rows) {
    const startedAt =
      parseDate(row.started_at) ??
      parseDate(row.startedAt) ??
      parseDate(row.created_at);
    if (!startedAt) continue;

    const sessionKey = getSessionKey(row, startedAt, "cry");
    const endedAt = parseDate(row.ended_at) ?? parseDate(row.endedAt);

    if (!seenCryStartSessions.has(sessionKey)) {
      seenCryStartSessions.add(sessionKey);
      crySessionStartMs.set(sessionKey, startedAt.getTime());
      try {
        await pushCryStart(row, sessionKey);
      } catch (err) {
        console.error("[push] Failed to send cry start push:", err);
      }
    }

    if (endedAt && !seenCryEndSessions.has(sessionKey)) {
      seenCryEndSessions.add(sessionKey);
      const startMs = crySessionStartMs.get(sessionKey);
      const resolvedStart = startMs ? new Date(startMs) : startedAt;

      try {
        await pushCryEnd(row, sessionKey, resolvedStart, endedAt);
      } catch (err) {
        console.error("[push] Failed to send cry end push:", err);
      }
    }
  }
}

async function pollSleepAlertsForPush(): Promise<void> {
  const result = await pool.query(
    `SELECT *
     FROM sleep_alerts
     WHERE started_at >= NOW() - $1::interval
     ORDER BY started_at ASC
     LIMIT 500`,
    [LOOKBACK_WINDOW],
  );

  const rows = result.rows as Record<string, unknown>[];
  if (!sleepBaselineInitialized) {
    for (const row of rows) {
      const startedAt =
        parseDate(row.started_at) ??
        parseDate(row.startedAt) ??
        parseDate(row.created_at);
      if (!startedAt) continue;

      const sessionKey = getSessionKey(row, startedAt, "sleep");
      seenSleepStartSessions.add(sessionKey);
      sleepSessionStartMs.set(sessionKey, startedAt.getTime());

      const endedAt = parseDate(row.ended_at) ?? parseDate(row.endedAt);
      if (endedAt) {
        seenSleepEndSessions.add(sessionKey);
      }
    }

    sleepBaselineInitialized = true;
    console.log("[push] Sleep push baseline initialized");
    return;
  }

  for (const row of rows) {
    const startedAt =
      parseDate(row.started_at) ??
      parseDate(row.startedAt) ??
      parseDate(row.created_at);
    if (!startedAt) continue;

    const sessionKey = getSessionKey(row, startedAt, "sleep");
    const endedAt = parseDate(row.ended_at) ?? parseDate(row.endedAt);

    if (!seenSleepStartSessions.has(sessionKey)) {
      seenSleepStartSessions.add(sessionKey);
      sleepSessionStartMs.set(sessionKey, startedAt.getTime());
      try {
        await pushSleepStart(row, sessionKey);
      } catch (err) {
        console.error("[push] Failed to send sleep start push:", err);
      }
    }

    if (endedAt && !seenSleepEndSessions.has(sessionKey)) {
      seenSleepEndSessions.add(sessionKey);
      const startMs = sleepSessionStartMs.get(sessionKey);
      const resolvedStart = startMs ? new Date(startMs) : startedAt;

      try {
        await pushSleepEnd(row, sessionKey, resolvedStart, endedAt);
      } catch (err) {
        console.error("[push] Failed to send sleep end push:", err);
      }
    }
  }
}

async function pollRiskyPostureAlertsForPush(): Promise<void> {
  const result = await pool.query(
    `SELECT *
     FROM risky_posture_alerts
     WHERE detected_at >= NOW() - $1::interval
     ORDER BY detected_at ASC
     LIMIT 500`,
    [LOOKBACK_WINDOW],
  );

  const rows = result.rows as Record<string, unknown>[];
  if (!riskyBaselineInitialized) {
    for (const row of rows) {
      const detectedAt =
        parseDate(row.detected_at) ??
        parseDate(row.detectedAt) ??
        parseDate(row.created_at);
      if (!detectedAt) continue;

      const alertKey = getRiskyKey(row, detectedAt);
      seenRiskyPostureAlerts.add(alertKey);
    }

    riskyBaselineInitialized = true;
    console.log("[push] Risky posture push baseline initialized");
    return;
  }

  for (const row of rows) {
    const detectedAt =
      parseDate(row.detected_at) ??
      parseDate(row.detectedAt) ??
      parseDate(row.created_at);
    if (!detectedAt) continue;

    const alertKey = getRiskyKey(row, detectedAt);
    if (seenRiskyPostureAlerts.has(alertKey)) continue;

    seenRiskyPostureAlerts.add(alertKey);
    try {
      await pushRiskyPostureAlert(row, alertKey);
    } catch (err) {
      console.error("[push] Failed to send risky posture push:", err);
    }
  }
}

async function pollTemperatureAlertsForPush(): Promise<void> {
  const result = await pool.query(
    `SELECT *
     FROM temperature_alerts
     WHERE created_at >= NOW() - $1::interval
     ORDER BY created_at ASC
     LIMIT 500`,
    [LOOKBACK_WINDOW],
  );

  const rows = result.rows as Record<string, unknown>[];
  if (!temperatureBaselineInitialized) {
    for (const row of rows) {
      const createdAt =
        parseDate(row.created_at) ??
        parseDate(row.createdAt) ??
        parseDate(row.ts);
      if (!createdAt) continue;

      const temperatureC =
        parseNumber(row.temperature_c) ?? parseNumber(row.temperatureC);
      const severity = parseTemperatureSeverity(row.severity, temperatureC);
      if (!severity || temperatureC === null) continue;

      const alertKey = getTemperatureAlertKey(row, createdAt);
      seenTemperatureAlerts.add(alertKey);
    }

    temperatureBaselineInitialized = true;
    console.log("[push] Temperature push baseline initialized");
    return;
  }

  for (const row of rows) {
    const createdAt =
      parseDate(row.created_at) ??
      parseDate(row.createdAt) ??
      parseDate(row.ts);
    if (!createdAt) continue;

    const temperatureC =
      parseNumber(row.temperature_c) ?? parseNumber(row.temperatureC);
    const severity = parseTemperatureSeverity(row.severity, temperatureC);
    if (!severity || temperatureC === null) continue;

    const alertKey = getTemperatureAlertKey(row, createdAt);
    if (seenTemperatureAlerts.has(alertKey)) continue;

    seenTemperatureAlerts.add(alertKey);
    try {
      await pushTemperatureAlert(row, alertKey);
    } catch (err) {
      console.error("[push] Failed to send temperature push:", err);
    }
  }
}

async function pollAllPushAlerts(): Promise<void> {
  await pollCryAlertsForPush();
  await pollSleepAlertsForPush();
  await pollRiskyPostureAlertsForPush();
  await pollTemperatureAlertsForPush();
}

export async function startCryPushNotifications(): Promise<void> {
  if (pollTimer) return;

  await pollAllPushAlerts();
  pollTimer = setInterval(() => {
    pollAllPushAlerts().catch((err) => {
      console.error("[push] Alert push poll error:", err);
    });
  }, POLL_INTERVAL_MS);

  console.log(
    "[push] Alert push notifier started (cry/sleep/risky posture/temperature)",
  );
}

export function stopCryPushNotifications(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}
