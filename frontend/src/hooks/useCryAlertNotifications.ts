import { useCallback, useEffect, useRef } from "react";
import { Platform } from "react-native";
import { useAuth } from "@clerk/clerk-expo";
import * as Notifications from "expo-notifications";
import { EXPO_PUSH_TOKEN_URL } from "../services/backend/config";

const CRY_ALERT_CHANNEL_ID = "cry-alerts";
const EXPO_PROJECT_ID = "61c545f9-a8d9-46ee-a86b-ef273e4da74e";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function hasNotificationPermission(
  settings: Notifications.NotificationPermissionsStatus,
): boolean {
  return (
    settings.granted ||
    settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  );
}

function isExpoPushToken(value: unknown): value is string {
  return (
    typeof value === "string" &&
    (value.startsWith("ExponentPushToken[") ||
      value.startsWith("ExpoPushToken["))
  );
}

export function useCryAlertNotifications(): void {
  const { getToken } = useAuth();
  const registeredTokenRef = useRef<string | null>(null);

  const registerTokenWithBackend = useCallback(
    async (expoPushToken: string): Promise<void> => {
      if (registeredTokenRef.current === expoPushToken) return;

      const authToken = await getToken();
      if (!authToken) {
        console.warn("[push] Missing Clerk auth token, skipping push token sync");
        return;
      }

      const response = await fetch(EXPO_PUSH_TOKEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          expo_push_token: expoPushToken,
          platform: Platform.OS,
        }),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(body || `Push token sync failed: ${response.status}`);
      }

      registeredTokenRef.current = expoPushToken;
      console.log("[push] Expo token registered to backend");
    },
    [getToken],
  );

  const setupPush = useCallback(async (): Promise<void> => {
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
    let allowed = hasNotificationPermission(current);

    if (!allowed) {
      const requested = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
          allowProvisional: false,
        },
      });
      allowed = hasNotificationPermission(requested);
    }

    if (!allowed) {
      console.warn("[push] Notifications permission not granted");
      return;
    }

    try {
      const expoToken = await Notifications.getExpoPushTokenAsync({
        projectId: EXPO_PROJECT_ID,
      });
      if (!isExpoPushToken(expoToken.data)) {
        console.warn("[push] Invalid Expo push token shape");
        return;
      }

      console.log("[push] Expo token acquired:", expoToken.data);
      await registerTokenWithBackend(expoToken.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[push] Failed to get/register Expo token:", message);
    }
  }, [registerTokenWithBackend]);

  useEffect(() => {
    let mounted = true;
    if (mounted) {
      setupPush().catch((err) => {
        const message = err instanceof Error ? err.message : String(err);
        console.error("[push] Setup error:", message);
      });
    }

    const tokenSub = Notifications.addPushTokenListener((token) => {
      if (!isExpoPushToken(token.data)) return;
      registerTokenWithBackend(token.data).catch((err) => {
        const message = err instanceof Error ? err.message : String(err);
        console.error("[push] Push token refresh sync failed:", message);
      });
    });

    return () => {
      mounted = false;
      tokenSub.remove();
    };
  }, [setupPush, registerTokenWithBackend]);
}
