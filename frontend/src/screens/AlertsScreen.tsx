import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  RefreshControl,
  Alert as NativeAlert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@clerk/clerk-expo";
import * as Haptics from "expo-haptics";
import { COLORS, LAYOUT } from "../constants";
import Header from "../components/common/Header";
import AlertItem from "../components/alerts/AlertItem";
import {
  Alert as AlertType,
  AlertSeverity,
  AlertStatus,
} from "../types/alert.types";
import {
  CRY_ALERTS_URL,
  SLEEP_ALERTS_URL,
  RISKY_POSTURE_ALERTS_URL,
  TEMPERATURE_ALERTS_URL,
} from "../services/backend/config";
import { connectToCryAlertStream } from "../services/backend/cryAlertClient";
import { connectToSleepAlertStream } from "../services/backend/sleepAlertClient";
import { connectToAiPoseStream } from "../services/backend/aiPoseClient";
import { connectToTemperatureAlertStream } from "../services/backend/temperatureAlertClient";
import {
  AiPosePayload,
  CryAlertPayload,
  SleepAlertPayload,
  TemperatureAlertPayload,
} from "../services/backend/types";

type FilterType = "all" | "critical" | "warning" | "info";
type TemperatureAlertSeverity = "normal_high" | "moderately_high" | "severe";

const MAX_ALERTS = 50;
const RISKY_ALERT_MIN_GAP_MS = 60_000;

function parseDateValue(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value !== "string" || value.length === 0) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseNumberValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.length > 0) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function parseBooleanValue(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (v === "true") return true;
    if (v === "false") return false;
  }
  return undefined;
}

function parseStringValue(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const v = value.trim();
  return v.length > 0 ? v : undefined;
}

function parseIdentifierValue(value: unknown): string | undefined {
  const asString = parseStringValue(value);
  if (asString) return asString;

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return undefined;
}

function parseSeverity(value: unknown, isActive: boolean): AlertSeverity {
  if (value === "critical" || value === "warning" || value === "info") {
    return value;
  }
  return isActive ? "critical" : "warning";
}

function parseStatus(value: unknown, isActive: boolean): AlertStatus {
  if (value === "unread" || value === "read" || value === "dismissed") {
    return value;
  }
  return isActive ? "unread" : "read";
}

function classifyTemperatureSeverity(
  temperatureC: number,
): TemperatureAlertSeverity | null {
  if (temperatureC <= 37.0) return null;
  if (temperatureC <= 37.5) return "normal_high";
  if (temperatureC <= 38.0) return "moderately_high";
  return "severe";
}

function parseTemperatureSeverity(
  value: unknown,
  temperatureC: number | undefined,
): TemperatureAlertSeverity | null {
  if (
    value === "normal_high" ||
    value === "moderately_high" ||
    value === "severe"
  ) {
    return value;
  }

  if (temperatureC === undefined || !Number.isFinite(temperatureC)) {
    return null;
  }
  return classifyTemperatureSeverity(temperatureC);
}

function mapTemperatureSeverityToAlertSeverity(
  severity: TemperatureAlertSeverity,
): AlertSeverity {
  if (severity === "severe") return "critical";
  if (severity === "moderately_high") return "warning";
  return "info";
}

function formatDateTime(date: Date): string {
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

function formatProb(prob?: number): string | null {
  if (prob === undefined || !Number.isFinite(prob)) return null;
  return `${Math.round(prob * 100)}%`;
}

function formatDurationSeconds(seconds: number): string {
  return `${seconds.toFixed(3)}s`;
}

function formatDurationCompact(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;

  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function resolveDurationSeconds(
  startedAt: Date,
  endedAt: Date | null,
  durationSeconds?: number,
): number {
  if (durationSeconds !== undefined && Number.isFinite(durationSeconds)) {
    return Math.max(0, durationSeconds);
  }

  if (!endedAt) {
    return Math.max(0, (Date.now() - startedAt.getTime()) / 1000);
  }

  return Math.max(0, (endedAt.getTime() - startedAt.getTime()) / 1000);
}

function buildCryMessage(
  startedAt: Date,
  endedAt: Date | null,
  durationSeconds?: number,
  startProb?: number,
  endProb?: number,
): string {
  const parts: string[] = [];
  parts.push(`Started at ${formatDateTime(startedAt)}.`);

  const startLabel = formatProb(startProb);
  if (startLabel) {
    parts.push(`Start confidence: ${startLabel}.`);
  }

  const resolvedDuration = resolveDurationSeconds(
    startedAt,
    endedAt,
    durationSeconds,
  );

  if (!endedAt) {
    parts.push("Still crying...");
    return parts.join(" ");
  }

  parts.push(`Ended at ${formatDateTime(endedAt)}.`);
  const endLabel = formatProb(endProb);
  if (endLabel) {
    parts.push(`End confidence: ${endLabel}.`);
  }

  return parts.join(" ");
}

function buildSleepMessage(
  startedAt: Date,
  endedAt: Date | null,
  durationSeconds?: number,
  _startEar?: number,
  _endEar?: number,
): string {
  const parts: string[] = [];
  parts.push(`Started at ${formatDateTime(startedAt)}.`);

  if (!endedAt) {
    parts.push("Still currently sleeping.");
    return parts.join(" ");
  }

  parts.push(`Woke up at ${formatDateTime(endedAt)}.`);

  const resolved = resolveDurationSeconds(startedAt, endedAt, durationSeconds);
  parts.push(`Slept for ${formatDurationCompact(resolved)}.`);

  return parts.join(" ");
}

function sortAndCap(alerts: AlertType[]): AlertType[] {
  return [...alerts]
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, MAX_ALERTS);
}

function isCloseTime(a: Date | undefined, b: Date | undefined, ms: number): boolean {
  if (!a || !b) return false;
  return Math.abs(a.getTime() - b.getTime()) <= ms;
}

function isSameAlertSemantic(fetched: AlertType, live: AlertType): boolean {
  if (fetched.id === live.id) return true;

  if (fetched.alertId && live.alertId && fetched.alertId === live.alertId) {
    return true;
  }

  if (fetched.category !== live.category) return false;
  if (!fetched.deviceId || !live.deviceId) return false;
  if (fetched.deviceId !== live.deviceId) return false;

  if (fetched.category === "sleep") {
    const fetchedStart = fetched.startedAt ?? fetched.timestamp;
    const liveStart = live.startedAt ?? live.timestamp;
    return isCloseTime(fetchedStart, liveStart, 15_000);
  }

  if (fetched.category === "movement") {
    return isCloseTime(fetched.timestamp, live.timestamp, 10_000);
  }

  if (fetched.category === "sound") {
    const fetchedStart = fetched.startedAt ?? fetched.timestamp;
    const liveStart = live.startedAt ?? live.timestamp;
    return isCloseTime(fetchedStart, liveStart, 8_000);
  }

  if (fetched.category === "temperature") {
    return isCloseTime(fetched.timestamp, live.timestamp, 10_000);
  }

  return false;
}

function mergeFetchedWithActiveLive(
  fetched: AlertType[],
  current: AlertType[],
): AlertType[] {
  const merged = [...fetched];

  for (const liveAlert of current) {
    const alreadyPresent = merged.some((fetchedAlert) =>
      isSameAlertSemantic(fetchedAlert, liveAlert),
    );

    if (!alreadyPresent) {
      merged.push(liveAlert);
    }
  }

  return sortAndCap(merged);
}

function mapCryAlertRowToAlert(raw: unknown): AlertType | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const row = raw as Record<string, unknown>;
  const startedAt =
    parseDateValue(row.started_at) ??
    parseDateValue(row.startedAt) ??
    parseDateValue(row.created_at) ??
    new Date();
  const endedAt = parseDateValue(row.ended_at) ?? parseDateValue(row.endedAt);
  const isActive = endedAt === null;

  const alertId =
    parseStringValue(row.alert_id) ??
    parseStringValue(row.alertId) ??
    parseStringValue(row.id);
  const deviceId =
    parseStringValue(row.device_id) ??
    parseStringValue(row.deviceId) ??
    "unknown-device";
  const id = alertId ?? `${deviceId}:${startedAt.toISOString()}`;

  const startProb =
    parseNumberValue(row.prob_start) ??
    parseNumberValue(row.start_prob) ??
    parseNumberValue(row.startProb) ??
    parseNumberValue(row.probability_start) ??
    parseNumberValue(row.prob);
  const endProb =
    parseNumberValue(row.prob_end) ??
    parseNumberValue(row.end_prob) ??
    parseNumberValue(row.endProb) ??
    parseNumberValue(row.probability_end);
  const durationSeconds =
    parseNumberValue(row.duration_s) ??
    parseNumberValue(row.duration_sec) ??
    parseNumberValue(row.duration_seconds);
  const resolvedDuration = resolveDurationSeconds(
    startedAt,
    endedAt,
    durationSeconds,
  );

  return {
    id,
    title: isActive
      ? "Crying in progress"
      : `Crying detected (${formatDurationSeconds(resolvedDuration)})`,
    message: buildCryMessage(
      startedAt,
      endedAt,
      durationSeconds,
      startProb,
      endProb,
    ),
    severity: parseSeverity(row.severity, isActive),
    category: "sound",
    status: parseStatus(row.status, isActive),
    timestamp: startedAt,
    icon: "volume-high-outline",
    deviceId,
    alertId,
    startedAt,
    endedAt,
    isActive,
    startProb,
    endProb,
  };
}

function mapSleepAlertRowToAlert(raw: unknown): AlertType | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const row = raw as Record<string, unknown>;
  const startedAt =
    parseDateValue(row.started_at) ??
    parseDateValue(row.startedAt) ??
    parseDateValue(row.created_at) ??
    new Date();
  const endedAt = parseDateValue(row.ended_at) ?? parseDateValue(row.endedAt);
  const isActive = endedAt === null;

  const alertId =
    parseStringValue(row.alert_id) ??
    parseStringValue(row.alertId) ??
    parseIdentifierValue(row.id);
  const deviceId =
    parseStringValue(row.device_id) ??
    parseStringValue(row.deviceId) ??
    "unknown-device";
  const id = `sleep:${alertId ?? `${deviceId}:${startedAt.toISOString()}`}`;

  const durationSeconds =
    parseNumberValue(row.duration_s) ??
    parseNumberValue(row.duration_sec) ??
    parseNumberValue(row.duration_seconds);
  const startEar =
    parseNumberValue(row.ear_start) ??
    parseNumberValue(row.start_ear) ??
    parseNumberValue(row.ear);
  const endEar =
    parseNumberValue(row.ear_end) ??
    parseNumberValue(row.end_ear) ??
    parseNumberValue(row.ear_wake);
  const resolvedDuration = resolveDurationSeconds(
    startedAt,
    endedAt,
    durationSeconds,
  );

  const rawSeverity = row.severity;
  const severity: AlertSeverity =
    rawSeverity === "critical" || rawSeverity === "warning" || rawSeverity === "info"
      ? rawSeverity
      : "info";

  return {
    id,
    title: isActive
      ? "Sleeping in progress"
      : `Baby woke up (${formatDurationCompact(resolvedDuration)})`,
    message: buildSleepMessage(
      startedAt,
      endedAt,
      durationSeconds,
      startEar,
      endEar,
    ),
    severity,
    category: "sleep",
    status: parseStatus(row.status, isActive),
    timestamp: startedAt,
    icon: "moon-outline",
    deviceId,
    alertId,
    startedAt,
    endedAt,
    isActive,
  };
}

function mapRiskyPostureRowToAlert(raw: unknown): AlertType | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const row = raw as Record<string, unknown>;
  const detectedAt =
    parseDateValue(row.detected_at) ??
    parseDateValue(row.detectedAt) ??
    parseDateValue(row.ts) ??
    parseDateValue(row.created_at) ??
    new Date();

  const alertId =
    parseStringValue(row.alert_id) ??
    parseStringValue(row.alertId) ??
    parseStringValue(row.id);
  const deviceId =
    parseStringValue(row.device_id) ??
    parseStringValue(row.deviceId) ??
    "unknown-device";
  const id = `risk:${alertId ?? `${deviceId}:${detectedAt.toISOString()}`}`;

  const noseConfidence =
    parseNumberValue(row.nose_confidence) ??
    parseNumberValue(row.noseConfidence);
  const faceFound =
    parseBooleanValue(row.face_found) ?? parseBooleanValue(row.faceFound);
  const eyesVisible =
    parseNumberValue(row.eyes_visible) ?? parseNumberValue(row.eyesVisible);

  const details: string[] = [`Detected at ${formatDateTime(detectedAt)}.`];
  if (noseConfidence !== undefined) {
    details.push(`Nose confidence: ${Math.round(noseConfidence * 100)}%.`);
  }
  if (faceFound !== undefined) {
    details.push(faceFound ? "Face found." : "Face not found.");
  }
  if (eyesVisible !== undefined) {
    details.push(`Eyes visible: ${Math.round(eyesVisible)}.`);
  }

  const rawSeverity = row.severity;
  const severity: AlertSeverity =
    rawSeverity === "critical" || rawSeverity === "warning" || rawSeverity === "info"
      ? rawSeverity
      : "critical";

  return {
    id,
    title: "Risky posture detected",
    message: details.join(" "),
    severity,
    category: "movement",
    status: parseStatus(row.status, true),
    timestamp: detectedAt,
    icon: "body-outline",
    deviceId,
    alertId,
    startedAt: detectedAt,
    endedAt: detectedAt,
    isActive: false,
  };
}

function mapTemperatureAlertRowToAlert(raw: unknown): AlertType | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const row = raw as Record<string, unknown>;
  const createdAt =
    parseDateValue(row.created_at) ??
    parseDateValue(row.createdAt) ??
    parseDateValue(row.ts) ??
    new Date();

  const temperatureC =
    parseNumberValue(row.temperature_c) ?? parseNumberValue(row.temperatureC);
  if (temperatureC === undefined || !Number.isFinite(temperatureC)) {
    return null;
  }

  const tempSeverity = parseTemperatureSeverity(row.severity, temperatureC);
  if (!tempSeverity) {
    return null;
  }

  const alertId =
    parseStringValue(row.alert_id) ??
    parseStringValue(row.alertId) ??
    parseStringValue(row.id);
  const deviceId =
    parseStringValue(row.device_id) ??
    parseStringValue(row.deviceId) ??
    "unknown-device";
  const id = `temp:${alertId ?? `${deviceId}:${createdAt.toISOString()}:${temperatureC.toFixed(2)}`}`;

  const severity = mapTemperatureSeverityToAlertSeverity(tempSeverity);
  const title =
    tempSeverity === "severe"
      ? "Severe temperature alert"
      : tempSeverity === "moderately_high"
        ? "Temperature moderately high"
        : "Temperature slightly high";

  const message = [
    `Detected at ${formatDateTime(createdAt)}.`,
    `Body temperature: ${temperatureC.toFixed(1)}°C.`,
    tempSeverity === "severe"
      ? "Please check your baby immediately."
      : tempSeverity === "moderately_high"
        ? "Please check on your baby."
        : "Monitor temperature closely.",
  ].join(" ");

  return {
    id,
    title,
    message,
    severity,
    category: "temperature",
    status: parseStatus(row.status, true),
    timestamp: createdAt,
    icon: "thermometer-outline",
    deviceId,
    alertId,
    startedAt: createdAt,
    endedAt: createdAt,
    isActive: false,
  };
}

function applyLiveCryPayload(
  current: AlertType[],
  payload: CryAlertPayload,
): AlertType[] {
  const eventTime = payload.ts ? new Date(payload.ts) : new Date();
  const eventAlertId = payload.alert_id?.trim();
  const eventDeviceId = payload.device_id;
  const prob = parseNumberValue(payload.prob);

  if (payload.event === "cry_start") {
    const id = eventAlertId ?? `active:${eventDeviceId}`;
    const index = current.findIndex(
      (a) =>
        a.id === id ||
        (!!eventAlertId && a.alertId === eventAlertId) ||
        (a.isActive && a.deviceId === eventDeviceId),
    );

    if (index === -1) {
      const newAlert: AlertType = {
        id,
        title: "Crying in progress",
        message: buildCryMessage(eventTime, null, undefined, prob),
        severity: "critical",
        category: "sound",
        status: "unread",
        timestamp: eventTime,
        icon: "volume-high-outline",
        deviceId: eventDeviceId,
        alertId: eventAlertId,
        startedAt: eventTime,
        endedAt: null,
        isActive: true,
        startProb: prob,
      };
      return sortAndCap([newAlert, ...current]);
    }

    const existing = current[index];
    const startedAt = existing.startedAt ?? existing.timestamp ?? eventTime;
    const resolvedId = eventAlertId ?? existing.id;
    const updated: AlertType = {
      ...existing,
      id: resolvedId,
      title: "Crying in progress",
      message: buildCryMessage(
        startedAt,
        null,
        undefined,
        existing.startProb ?? prob,
      ),
      severity: "critical",
      status: "unread",
      deviceId: eventDeviceId,
      alertId: eventAlertId ?? existing.alertId,
      startedAt,
      endedAt: null,
      isActive: true,
      startProb: existing.startProb ?? prob,
    };

    const next = [...current];
    next[index] = updated;
    return sortAndCap(next);
  }

  // cry_end
  let index = -1;
  if (eventAlertId) {
    index = current.findIndex(
      (a) => a.id === eventAlertId || a.alertId === eventAlertId,
    );
  }
  if (index === -1) {
    index = current.findIndex(
      (a) => a.isActive && a.deviceId === eventDeviceId,
    );
  }
  if (index === -1) {
    // Ignore duplicate/noise end packets when we cannot map them to an active session.
    return current;
  }

  const existing = current[index];
  if (!existing.isActive) {
    // We already ended this alert; ignore repeated end packets.
    return current;
  }

  const startedAt = existing.startedAt ?? existing.timestamp ?? eventTime;
  const resolvedId = eventAlertId ?? existing.id;
  const updated: AlertType = {
    ...existing,
    id: resolvedId,
    title: `Crying detected (${formatDurationSeconds(
      resolveDurationSeconds(startedAt, eventTime),
    )})`,
    message: buildCryMessage(
      startedAt,
      eventTime,
      undefined,
      existing.startProb,
      prob,
    ),
    severity: "warning",
    status: "unread",
    alertId: eventAlertId ?? existing.alertId,
    startedAt,
    endedAt: eventTime,
    isActive: false,
    endProb: prob,
  };

  const next = [...current];
  next[index] = updated;
  return sortAndCap(next);
}

function applyLiveSleepPayload(
  current: AlertType[],
  payload: SleepAlertPayload,
): AlertType[] {
  const eventTime = payload.ts ? new Date(payload.ts) : new Date();
  const eventType = payload.data?.event;
  const eventDeviceId = payload.data?.device_id;
  const eventEar = parseNumberValue(payload.data?.ear);

  if (!eventType || !eventDeviceId) {
    return current;
  }

  if (eventType === "baby_fell_asleep") {
    const existingIndex = current.findIndex(
      (a) => a.category === "sleep" && a.isActive && a.deviceId === eventDeviceId,
    );

    if (existingIndex === -1) {
      const id = `sleep:live:${eventDeviceId}:${eventTime.getTime()}`;
      const newAlert: AlertType = {
        id,
        title: "Sleeping in progress",
        message: buildSleepMessage(eventTime, null, undefined, eventEar),
        severity: "info",
        category: "sleep",
        status: "unread",
        timestamp: eventTime,
        icon: "moon-outline",
        deviceId: eventDeviceId,
        startedAt: eventTime,
        endedAt: null,
        isActive: true,
      };
      return sortAndCap([newAlert, ...current]);
    }

    const existing = current[existingIndex];
    const startedAt = existing.startedAt ?? existing.timestamp ?? eventTime;
    const updated: AlertType = {
      ...existing,
      title: "Sleeping in progress",
      message: buildSleepMessage(startedAt, null, undefined, eventEar),
      severity: "info",
      status: "unread",
      startedAt,
      endedAt: null,
      isActive: true,
    };

    const next = [...current];
    next[existingIndex] = updated;
    return sortAndCap(next);
  }

  if (eventType !== "baby_woke_up") {
    return current;
  }

  const existingIndex = current.findIndex(
    (a) => a.category === "sleep" && a.isActive && a.deviceId === eventDeviceId,
  );

  if (existingIndex === -1) {
    const id = `sleep:live:${eventDeviceId}:${eventTime.getTime()}`;
    const wakeAlert: AlertType = {
      id,
      title: "Baby woke up (0s)",
      message: buildSleepMessage(eventTime, eventTime, 0, undefined, eventEar),
      severity: "info",
      category: "sleep",
      status: "unread",
      timestamp: eventTime,
      icon: "moon-outline",
      deviceId: eventDeviceId,
      startedAt: eventTime,
      endedAt: eventTime,
      isActive: false,
    };
    return sortAndCap([wakeAlert, ...current]);
  }

  const existing = current[existingIndex];
  const startedAt = existing.startedAt ?? existing.timestamp ?? eventTime;
  const duration = resolveDurationSeconds(startedAt, eventTime);
  const updated: AlertType = {
    ...existing,
    title: `Baby woke up (${formatDurationCompact(duration)})`,
    message: buildSleepMessage(startedAt, eventTime, undefined, undefined, eventEar),
    severity: "info",
    status: "unread",
    startedAt,
    endedAt: eventTime,
    isActive: false,
  };

  const next = [...current];
  next[existingIndex] = updated;
  return sortAndCap(next);
}

function applyLiveRiskyPosePayload(
  current: AlertType[],
  payload: AiPosePayload,
): AlertType[] {
  const eventTime = payload.ts ? new Date(payload.ts) : new Date();
  const deviceId = payload.data?.device_id ?? "unknown-device";
  const noseConfidence = parseNumberValue(payload.data?.nose_confidence);
  const faceFound = payload.data?.face_found;
  const eyesVisible = parseNumberValue(payload.data?.eyes_visible);

  const latestForDevice = current.find(
    (a) => a.category === "movement" && a.deviceId === deviceId,
  );
  if (
    latestForDevice &&
    eventTime.getTime() - latestForDevice.timestamp.getTime() <
      RISKY_ALERT_MIN_GAP_MS
  ) {
    return current;
  }

  const parts: string[] = [`Detected at ${formatDateTime(eventTime)}.`];
  if (noseConfidence !== undefined) {
    parts.push(`Nose confidence: ${Math.round(noseConfidence * 100)}%.`);
  }
  if (faceFound !== undefined) {
    parts.push(faceFound ? "Face found." : "Face not found.");
  }
  if (eyesVisible !== undefined) {
    parts.push(`Eyes visible: ${Math.round(eyesVisible)}.`);
  }

  const newAlert: AlertType = {
    id: `risk:live:${deviceId}:${eventTime.getTime()}`,
    title: "Risky posture detected",
    message: parts.join(" "),
    severity: "critical",
    category: "movement",
    status: "unread",
    timestamp: eventTime,
    icon: "body-outline",
    deviceId,
    startedAt: eventTime,
    endedAt: eventTime,
    isActive: false,
  };

  return sortAndCap([newAlert, ...current]);
}

function applyLiveTemperaturePayload(
  current: AlertType[],
  payload: TemperatureAlertPayload,
): AlertType[] {
  if (payload.event !== "temperature_alert") {
    return current;
  }

  const createdAt =
    parseDateValue(payload.created_at) ??
    parseDateValue(payload.ts) ??
    new Date();
  const temperatureC = parseNumberValue(payload.temperature_c);
  if (temperatureC === undefined || !Number.isFinite(temperatureC)) {
    return current;
  }

  const tempSeverity = parseTemperatureSeverity(payload.severity, temperatureC);
  if (!tempSeverity) {
    return current;
  }

  const severity = mapTemperatureSeverityToAlertSeverity(tempSeverity);
  const title =
    tempSeverity === "severe"
      ? "Severe temperature alert"
      : tempSeverity === "moderately_high"
        ? "Temperature moderately high"
        : "Temperature slightly high";
  const message = [
    `Detected at ${formatDateTime(createdAt)}.`,
    `Body temperature: ${temperatureC.toFixed(1)}°C.`,
    tempSeverity === "severe"
      ? "Please check your baby immediately."
      : tempSeverity === "moderately_high"
        ? "Please check on your baby."
        : "Monitor temperature closely.",
  ].join(" ");

  const deviceId = parseStringValue(payload.device_id) ?? "unknown-device";
  const alertId = parseStringValue(payload.alert_id);
  const id = `temp:${alertId ?? `${deviceId}:${createdAt.toISOString()}:${temperatureC.toFixed(2)}`}`;

  const exists = current.some(
    (a) =>
      a.id === id ||
      (!!alertId && a.alertId === alertId) ||
      (a.category === "temperature" &&
        a.deviceId === deviceId &&
        isCloseTime(a.timestamp, createdAt, 5_000)),
  );
  if (exists) {
    return current;
  }

  const newAlert: AlertType = {
    id,
    title,
    message,
    severity,
    category: "temperature",
    status: "unread",
    timestamp: createdAt,
    icon: "thermometer-outline",
    deviceId,
    alertId,
    startedAt: createdAt,
    endedAt: createdAt,
    isActive: false,
  };

  return sortAndCap([newAlert, ...current]);
}

const AlertsScreen = () => {
  const { getToken } = useAuth();
  const riskyStateByDeviceRef = useRef<Map<string, boolean>>(new Map());
  const missingEndpointWarningsRef = useRef<Set<string>>(new Set());
  const [alerts, setAlerts] = useState<AlertType[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const unreadCount = alerts.filter((a) => a.status === "unread").length;

  const filteredAlerts = useMemo(() => {
    return alerts.filter((alert) => {
      if (activeFilter === "all") return true;
      return alert.severity === activeFilter;
    });
  }, [alerts, activeFilter]);

  const fetchAlerts = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) {
        throw new Error("Missing auth token");
      }

      const headers = { Authorization: `Bearer ${token}` };
      const [cryResponse, sleepResponse, riskyResponse, temperatureResponse] =
        await Promise.all([
        fetch(`${CRY_ALERTS_URL}?limit=${MAX_ALERTS}`, { headers }),
        fetch(`${SLEEP_ALERTS_URL}?limit=${MAX_ALERTS}`, { headers }),
        fetch(`${RISKY_POSTURE_ALERTS_URL}?limit=${MAX_ALERTS}`, { headers }),
        fetch(`${TEMPERATURE_ALERTS_URL}?limit=${MAX_ALERTS}`, { headers }),
      ]);

      if (!cryResponse.ok) {
        const body = await cryResponse.text().catch(() => "");
        throw new Error(body || `cry alerts returned ${cryResponse.status}`);
      }

      const cryRows = (await cryResponse.json()) as unknown[];

      const parseOptionalRows = async (
        label: "sleep" | "risky-posture" | "temperature",
        response: Response,
      ): Promise<unknown[]> => {
        if (response.ok) {
          return (await response.json()) as unknown[];
        }

        if (response.status === 404) {
          if (!missingEndpointWarningsRef.current.has(label)) {
            missingEndpointWarningsRef.current.add(label);
            console.warn(
              `[AlertsScreen] Optional endpoint missing: /api/alerts/${label}. Deploy latest backend to enable history sync.`,
            );
          }
          return [];
        }

        const body = await response.text().catch(() => "");
        throw new Error(
          body || `${label} alerts returned ${response.status}`,
        );
      };

      const [sleepRows, riskyRows, temperatureRows] = await Promise.all([
        parseOptionalRows("sleep", sleepResponse),
        parseOptionalRows("risky-posture", riskyResponse),
        parseOptionalRows("temperature", temperatureResponse),
      ]);

      const fetchedAlerts = [
        ...cryRows.map(mapCryAlertRowToAlert),
        ...sleepRows.map(mapSleepAlertRowToAlert),
        ...riskyRows.map(mapRiskyPostureRowToAlert),
        ...temperatureRows.map(mapTemperatureAlertRowToAlert),
      ].filter((alert): alert is AlertType => alert !== null);

      setAlerts((current) => mergeFetchedWithActiveLive(fetchedAlerts, current));
      setFetchError(null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to fetch alerts";
      setFetchError(message);
      console.error("[AlertsScreen] fetch alerts error:", message);
    } finally {
      setIsLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  useEffect(() => {
    const disconnectCry = connectToCryAlertStream(
      (payload) => {
        setAlerts((current) => applyLiveCryPayload(current, payload));
      },
      (err) => {
        console.error("[AlertsScreen] cry stream error:", err.message);
      },
    );

    const disconnectSleep = connectToSleepAlertStream(
      (payload) => {
        setAlerts((current) => applyLiveSleepPayload(current, payload));
      },
      (err) => {
        console.error("[AlertsScreen] sleep stream error:", err.message);
      },
    );

    const disconnectPose = connectToAiPoseStream(
      (payload) => {
        const deviceId = payload.data?.device_id;
        if (!deviceId) return;

        const isRisky = payload.data?.is_risky === true;
        const previous = riskyStateByDeviceRef.current.get(deviceId) ?? false;
        riskyStateByDeviceRef.current.set(deviceId, isRisky);

        if (!isRisky || previous) return;
        setAlerts((current) => applyLiveRiskyPosePayload(current, payload));
      },
      (err) => {
        console.error("[AlertsScreen] pose stream error:", err.message);
      },
    );

    const disconnectTemperature = connectToTemperatureAlertStream(
      (payload) => {
        setAlerts((current) => applyLiveTemperaturePayload(current, payload));
      },
      (err) => {
        console.error("[AlertsScreen] temperature stream error:", err.message);
      },
    );

    return () => {
      disconnectCry();
      disconnectSleep();
      disconnectPose();
      disconnectTemperature();
    };
  }, []);

  const handleAlertPress = (alert: AlertType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setAlerts((prev) =>
      prev.map((a) => (a.id === alert.id ? { ...a, status: "read" } : a)),
    );
  };

  const handleMarkAllRead = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setAlerts((prev) => prev.map((a) => ({ ...a, status: "read" })));
  };

  const handleClearAll = () => {
    if (alerts.length === 0) return;
    NativeAlert.alert("Clear all alerts?", "This clears alerts from this session.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        style: "destructive",
        onPress: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          setAlerts([]);
        },
      },
    ]);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAlerts();
    setRefreshing(false);
  }, [fetchAlerts]);

  const FilterButton = ({
    filter,
    label,
    count,
  }: {
    filter: FilterType;
    label: string;
    count?: number;
  }) => (
    <TouchableOpacity
      style={[
        styles.filterButton,
        activeFilter === filter && styles.filterButtonActive,
      ]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        setActiveFilter(filter);
      }}
    >
      <Text
        style={[
          styles.filterText,
          activeFilter === filter && styles.filterTextActive,
        ]}
      >
        {label}
      </Text>
      {count !== undefined && count > 0 && (
        <View
          style={[
            styles.filterBadge,
            activeFilter === filter && styles.filterBadgeActive,
          ]}
        >
          <Text
            style={[
              styles.filterBadgeText,
              activeFilter === filter && styles.filterBadgeTextActive,
            ]}
          >
            {count}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const HeaderRight = (
    <TouchableOpacity
      style={styles.headerButton}
      onPress={handleMarkAllRead}
      disabled={unreadCount === 0}
    >
      <Ionicons
        name="checkmark-done-outline"
        size={22}
        color={unreadCount > 0 ? COLORS.primary : COLORS.gray}
      />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Alerts" rightComponent={HeaderRight} />

      {fetchError && (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle-outline" size={16} color={COLORS.error} />
          <Text style={styles.errorText} numberOfLines={2}>
            {fetchError}
          </Text>
        </View>
      )}

      <View style={styles.summaryCard}>
        <View style={styles.summaryItem}>
          <View style={[styles.summaryIcon, { backgroundColor: "#FFEBEE" }]}>
            <Ionicons name="alert-circle" size={20} color={COLORS.error} />
          </View>
          <Text style={styles.summaryCount}>
            {alerts.filter((a) => a.severity === "critical").length}
          </Text>
          <Text style={styles.summaryLabel}>Critical</Text>
        </View>

        <View style={styles.summaryDivider} />

        <View style={styles.summaryItem}>
          <View style={[styles.summaryIcon, { backgroundColor: "#FFF3E0" }]}>
            <Ionicons name="warning" size={20} color={COLORS.warning} />
          </View>
          <Text style={styles.summaryCount}>
            {alerts.filter((a) => a.severity === "warning").length}
          </Text>
          <Text style={styles.summaryLabel}>Warnings</Text>
        </View>

        <View style={styles.summaryDivider} />

        <View style={styles.summaryItem}>
          <View style={[styles.summaryIcon, { backgroundColor: "#E3F2FD" }]}>
            <Ionicons name="notifications" size={20} color={COLORS.primary} />
          </View>
          <Text style={styles.summaryCount}>{unreadCount}</Text>
          <Text style={styles.summaryLabel}>Unread</Text>
        </View>
      </View>

      <View style={styles.filterContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          <FilterButton filter="all" label="All" count={alerts.length} />
          <FilterButton
            filter="critical"
            label="Critical"
            count={alerts.filter((a) => a.severity === "critical").length}
          />
          <FilterButton
            filter="warning"
            label="Warning"
            count={alerts.filter((a) => a.severity === "warning").length}
          />
          <FilterButton
            filter="info"
            label="Info"
            count={alerts.filter((a) => a.severity === "info").length}
          />
        </ScrollView>
      </View>

      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.content}>
          {filteredAlerts.length > 0 ? (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Recent</Text>
                {alerts.length > 0 && (
                  <TouchableOpacity onPress={handleClearAll}>
                    <Text style={styles.clearText}>Clear All</Text>
                  </TouchableOpacity>
                )}
              </View>

              {filteredAlerts.map((alert) => (
                <AlertItem
                  key={alert.id}
                  alert={alert}
                  onPress={handleAlertPress}
                />
              ))}
            </>
          ) : (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Ionicons
                  name="notifications-off-outline"
                  size={48}
                  color={COLORS.gray}
                />
              </View>
              <Text style={styles.emptyTitle}>No Alerts</Text>
              <Text style={styles.emptyMessage}>
                {isLoading
                  ? "Loading alerts..."
                  : activeFilter === "all"
                    ? "You're all caught up! No alerts to display."
                    : `No ${activeFilter} alerts at this time.`}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  headerButton: {
    padding: LAYOUT.spacing.xs,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFEBEE",
    marginHorizontal: LAYOUT.spacing.md,
    marginTop: LAYOUT.spacing.sm,
    marginBottom: LAYOUT.spacing.sm,
    padding: LAYOUT.spacing.sm,
    borderRadius: LAYOUT.borderRadius.sm,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.error,
  },
  summaryCard: {
    flexDirection: "row",
    backgroundColor: COLORS.white,
    marginHorizontal: LAYOUT.spacing.md,
    marginTop: LAYOUT.spacing.sm,
    marginBottom: LAYOUT.spacing.md,
    padding: LAYOUT.spacing.md,
    borderRadius: LAYOUT.borderRadius.md,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryItem: {
    flex: 1,
    alignItems: "center",
  },
  summaryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: LAYOUT.spacing.xs,
  },
  summaryCount: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  summaryLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  summaryDivider: {
    width: 1,
    backgroundColor: COLORS.lightGray,
    marginVertical: LAYOUT.spacing.xs,
  },
  filterContainer: {
    marginBottom: LAYOUT.spacing.sm,
  },
  filterScroll: {
    paddingHorizontal: LAYOUT.spacing.md,
  },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: LAYOUT.spacing.md,
    paddingVertical: LAYOUT.spacing.sm,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    marginRight: LAYOUT.spacing.sm,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
  },
  filterButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterText: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.textSecondary,
  },
  filterTextActive: {
    color: COLORS.white,
  },
  filterBadge: {
    marginLeft: 6,
    backgroundColor: COLORS.lightGray,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: "center",
  },
  filterBadgeActive: {
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  filterBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  filterBadgeTextActive: {
    color: COLORS.white,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: LAYOUT.spacing.md,
    paddingTop: 0,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: LAYOUT.spacing.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.textPrimary,
  },
  clearText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: "500",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: LAYOUT.spacing.xl * 2,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.lightGray,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: LAYOUT.spacing.md,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.textPrimary,
    marginBottom: LAYOUT.spacing.xs,
  },
  emptyMessage: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: "center",
    paddingHorizontal: LAYOUT.spacing.xl,
  },
});

export default AlertsScreen;
