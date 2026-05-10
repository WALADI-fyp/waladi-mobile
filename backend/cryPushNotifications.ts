import https from "https";
import { pool } from "./db";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const POLL_INTERVAL_MS = 5000;
const LOOKBACK_WINDOW = "2 hours";

const seenStartSessions = new Set<string>();
const seenEndSessions = new Set<string>();
const sessionStartMs = new Map<string, number>();

let pollTimer: NodeJS.Timeout | null = null;
let baselineInitialized = false;

function parseString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  return v.length > 0 ? v : null;
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
  if (typeof value !== "string" || value.length === 0) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDuration(seconds: number): string {
  return `${seconds.toFixed(3)}s`;
}

function formatProb(prob: number | null): string | null {
  if (prob === null) return null;
  return `${Math.round(prob * 100)}% confidence`;
}

function getSessionKey(row: Record<string, unknown>, startedAt: Date): string {
  const alertId = parseString(row.alert_id) ?? parseString(row.alertId);
  if (alertId) return `alert:${alertId}`;

  const deviceId =
    parseString(row.device_id) ?? parseString(row.deviceId) ?? "unknown-device";
  return `device:${deviceId}:start:${startedAt.toISOString()}`;
}

function getDeviceId(row: Record<string, unknown>): string | null {
  return parseString(row.device_id) ?? parseString(row.deviceId);
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

async function pushCryStart(row: Record<string, unknown>, sessionKey: string) {
  const userIds = await resolveUserIds(row);
  const tokens = await resolveTokensForUsers(userIds);
  if (tokens.length === 0) return;

  const prob = parseNumber(row.prob_start) ?? parseNumber(row.prob);
  const probText = formatProb(prob);
  const body = probText
    ? `Baby started crying (${probText}).`
    : "Baby started crying.";

  const messages = tokens.map((to) => ({
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

  await postExpoPush(messages);
}

async function pushCryEnd(
  row: Record<string, unknown>,
  sessionKey: string,
  startedAt: Date,
  endedAt: Date,
) {
  const userIds = await resolveUserIds(row);
  const tokens = await resolveTokensForUsers(userIds);
  if (tokens.length === 0) return;

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

  const messages = tokens.map((to) => ({
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

  await postExpoPush(messages);
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
  if (!baselineInitialized) {
    for (const row of rows) {
      const startedAt =
        parseDate(row.started_at) ??
        parseDate(row.startedAt) ??
        parseDate(row.created_at);
      if (!startedAt) continue;

      const sessionKey = getSessionKey(row, startedAt);
      seenStartSessions.add(sessionKey);
      sessionStartMs.set(sessionKey, startedAt.getTime());

      const endedAt = parseDate(row.ended_at) ?? parseDate(row.endedAt);
      if (endedAt) {
        seenEndSessions.add(sessionKey);
      }
    }

    baselineInitialized = true;
    console.log("[push] Cry push baseline initialized");
    return;
  }

  for (const row of rows) {
    const startedAt =
      parseDate(row.started_at) ??
      parseDate(row.startedAt) ??
      parseDate(row.created_at);
    if (!startedAt) continue;

    const sessionKey = getSessionKey(row, startedAt);
    const endedAt = parseDate(row.ended_at) ?? parseDate(row.endedAt);

    if (!seenStartSessions.has(sessionKey)) {
      seenStartSessions.add(sessionKey);
      sessionStartMs.set(sessionKey, startedAt.getTime());
      try {
        await pushCryStart(row, sessionKey);
      } catch (err) {
        console.error("[push] Failed to send cry start push:", err);
      }
    }

    if (endedAt && !seenEndSessions.has(sessionKey)) {
      seenEndSessions.add(sessionKey);
      const startMs = sessionStartMs.get(sessionKey);
      const resolvedStart = startMs ? new Date(startMs) : startedAt;

      try {
        await pushCryEnd(row, sessionKey, resolvedStart, endedAt);
      } catch (err) {
        console.error("[push] Failed to send cry end push:", err);
      }
    }
  }
}

export async function startCryPushNotifications(): Promise<void> {
  if (pollTimer) return;

  await pollCryAlertsForPush();
  pollTimer = setInterval(() => {
    pollCryAlertsForPush().catch((err) => {
      console.error("[push] Cry push poll error:", err);
    });
  }, POLL_INTERVAL_MS);

  console.log("[push] Cry push notifier started");
}

export function stopCryPushNotifications(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}
