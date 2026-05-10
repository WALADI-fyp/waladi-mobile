import { useEffect, useRef } from "react";
import { Alert } from "react-native";
import * as Haptics from "expo-haptics";
import { connectToCryAlertStream } from "../services/backend/cryAlertClient";
import { CryAlertPayload } from "../services/backend/types";

function buildStartKey(payload: CryAlertPayload): string {
  return [
    payload.event,
    payload.alert_id ?? "no-alert-id",
    payload.device_id,
    payload.ts ?? "no-ts",
  ].join("|");
}

function probabilityLabel(prob: number): string {
  if (!Number.isFinite(prob)) return "";
  return `${Math.round(prob * 100)}% confidence`;
}

export function useCryAlertNotifications(): void {
  const seenStartEventsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const disconnect = connectToCryAlertStream(
      (payload) => {
        if (payload.event !== "cry_start") return;

        const key = buildStartKey(payload);
        if (seenStartEventsRef.current.has(key)) return;
        seenStartEventsRef.current.add(key);

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
          () => {
            // Ignore haptic failures on unsupported devices.
          },
        );

        const probText = probabilityLabel(payload.prob);
        Alert.alert(
          "Crying detected",
          probText
            ? `Baby started crying (${probText}).`
            : "Baby started crying.",
        );
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
