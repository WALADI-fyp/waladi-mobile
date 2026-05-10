import React, { useState, useCallback, useEffect, useMemo } from "react";
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
import { CRY_ALERTS_URL } from "../services/backend/config";
import { connectToCryAlertStream } from "../services/backend/cryAlertClient";
import { CryAlertPayload } from "../services/backend/types";

type FilterType = "all" | "critical" | "warning" | "info";

const MAX_ALERTS = 50;

function parseDateValue(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
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

function parseStringValue(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const v = value.trim();
  return v.length > 0 ? v : undefined;
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

function sortAndCap(alerts: AlertType[]): AlertType[] {
  return [...alerts]
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, MAX_ALERTS);
}

function mergeFetchedWithActiveLive(
  fetched: AlertType[],
  current: AlertType[],
): AlertType[] {
  const byId = new Map<string, AlertType>();

  for (const alert of fetched) {
    byId.set(alert.id, alert);
  }

  for (const alert of current) {
    if (!byId.has(alert.id)) {
      byId.set(alert.id, alert);
    }
  }

  return sortAndCap(Array.from(byId.values()));
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

const AlertsScreen = () => {
  const { getToken } = useAuth();
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

      const response = await fetch(`${CRY_ALERTS_URL}?limit=${MAX_ALERTS}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(body || `Server returned ${response.status}`);
      }

      const rows = (await response.json()) as unknown[];
      const fetchedAlerts = rows
        .map(mapCryAlertRowToAlert)
        .filter((alert): alert is AlertType => alert !== null);

      setAlerts((current) => mergeFetchedWithActiveLive(fetchedAlerts, current));
      setFetchError(null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to fetch cry alerts";
      setFetchError(message);
      console.error("[AlertsScreen] fetch cry alerts error:", message);
    } finally {
      setIsLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  useEffect(() => {
    const disconnect = connectToCryAlertStream(
      (payload) => {
        setAlerts((current) => applyLiveCryPayload(current, payload));
      },
      (err) => {
        console.error("[AlertsScreen] cry stream error:", err.message);
      },
    );

    return () => {
      disconnect();
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
                  ? "Loading cry alerts..."
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
