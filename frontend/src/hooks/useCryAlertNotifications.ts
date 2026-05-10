import { useEffect } from "react";
import { Platform } from "react-native";
import * as Haptics from "expo-haptics";
import * as Notifications from "expo-notifications";
import { connectToCryAlertStream } from "../services/backend/cryAlertClient";
import { CryAlertPayload } from "../services/backend/types";

const CRY_ALERT_CHANNEL_ID = "cry-alerts";

// Persist in module scope so remounts/hot reload don't re-alert the same session.
const activeSessionByDevice = new Map<string, string>();
const notifiedStartSessions = new Set<string>();
const notifiedEndSessions = new Set<string>();
const sessionStartedAtMs = new Map<string, number>();

let notificationPermissionPromise: Promise<boolean> | null = null;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function buildDeviceKey(deviceId: string): string {
  return `device:${deviceId}`;
}

function buildAlertKey(alertId: string): string {
  return `alert:${alertId}`;
}

function getAlertId(payload: CryAlertPayload): string | null {
  const value = payload.alert_id?.trim();
  return value && value.length > 0 ? value : null;
}

function resolveSessionKey(payload: CryAlertPayload): string {
  const alertId = getAlertId(payload);
  if (alertId) return buildAlertKey(alertId);

  const deviceKey = buildDeviceKey(payload.device_id);
  return activeSessionByDevice.get(deviceKey) ?? deviceKey;
}

function probabilityLabel(prob: number): string {
  if (!Number.isFinite(prob)) return "";
  return `${Math.round(prob * 100)}% confidence`;
}

function formatDurationSeconds(seconds: number): string {
  return `${seconds.toFixed(3)}s`;
}

function hasNotificationPermission(
  settings: Notifications.NotificationPermissionsStatus,
): boolean {
  return (
    settings.granted ||
    settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  );
}

async function ensureNotificationPermission(): Promise<boolean> {
  if (notificationPermissionPromise) {
    return notificationPermissionPromise;
  }

  notificationPermissionPromise = (async () => {
    try {
      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync(CRY_ALERT_CHANNEL_ID, {
          name: "Cry Alerts",
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: "#FF231F7C",
          sound: "default",
        });
      }

      const current = await Notifications.getPermissionsAsync();
      if (hasNotificationPermission(current)) {
        return true;
      }

      const requested = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
          allowProvisional: false,
        },
      });
      return hasNotificationPermission(requested);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[cry-alert] Notification permission error:", message);
      return false;
    }
  })();

  return notificationPermissionPromise;
}

async function sendLocalNotification(
  title: string,
  body: string,
  payload: CryAlertPayload,
): Promise<void> {
  const allowed = await ensureNotificationPermission();
  if (!allowed) return;

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: "default",
        data: {
          type: payload.event,
          device_id: payload.device_id,
          alert_id: payload.alert_id ?? null,
          prob: payload.prob,
        },
      },
      trigger: null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cry-alert] Failed to schedule local notification:", message);
  }
}

export function useCryAlertNotifications(): void {
  useEffect(() => {
    // Warm-up permissions/channel at startup.
    ensureNotificationPermission().catch(() => {});

    const disconnect = connectToCryAlertStream(
      (payload) => {
        const deviceKey = buildDeviceKey(payload.device_id);
        const sessionKey = resolveSessionKey(payload);

        if (payload.event === "cry_start") {
          activeSessionByDevice.set(deviceKey, sessionKey);
          notifiedEndSessions.delete(sessionKey);
          sessionStartedAtMs.set(sessionKey, payload.ts ?? Date.now());

          if (notifiedStartSessions.has(sessionKey)) return;
          notifiedStartSessions.add(sessionKey);

          Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Warning,
          ).catch(() => {});

          const probText = probabilityLabel(payload.prob);
          const body = probText
            ? `Baby started crying (${probText}).`
            : "Baby started crying.";

          void sendLocalNotification("Crying detected", body, payload);
          return;
        }

        if (payload.event === "cry_end") {
          // If start was missed and end has no alert_id, skip noisy/duplicate end pings.
          if (!activeSessionByDevice.has(deviceKey) && !getAlertId(payload)) {
            return;
          }

          activeSessionByDevice.delete(deviceKey);
          notifiedStartSessions.delete(sessionKey);

          if (notifiedEndSessions.has(sessionKey)) return;
          notifiedEndSessions.add(sessionKey);
          const startedAtMs = sessionStartedAtMs.get(sessionKey);
          sessionStartedAtMs.delete(sessionKey);
          const endedAtMs = payload.ts ?? Date.now();
          const durationSeconds =
            startedAtMs !== undefined
              ? Math.max(0, (endedAtMs - startedAtMs) / 1000)
              : undefined;

          Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success,
          ).catch(() => {});

          const probText = probabilityLabel(payload.prob);
          const title = durationSeconds !== undefined
            ? `Crying detected (${formatDurationSeconds(durationSeconds)})`
            : "Crying detected";
          const body = probText
            ? `Baby stopped crying (${probText}).`
            : "Baby stopped crying.";

          void sendLocalNotification(title, body, payload);
        }
      },
      (err) => {
        console.error("[cry-alert] Notification stream error:", err.message);
      },
    );

    return () => {
      disconnect();
    };
  }, []);
}
