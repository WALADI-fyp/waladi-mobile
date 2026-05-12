import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { COLORS, LAYOUT } from "../constants";
import Header from "../components/common/Header";
import TabSwitcher from "../components/common/TabSwitcher";
import MetricCard from "../components/analytics/MetricCard";
import TemperatureChart from "../components/analytics/TemperatureChart";
import { useAnalytics } from "../hooks/useAnalytics";
import { ChartDataPoint, MetricData, WeeklyReport } from "../types/analytics.types";

type AnalyticsTab = "Environment" | "Baby";
type TrendIntent = "direction" | "higher_is_better" | "lower_is_better";

const WEEKS_TO_FETCH = 8;

function formatWeekLabel(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatWeekRange(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const endExclusive = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(endExclusive.getTime())) {
    return "Unknown week";
  }

  // week_end is exclusive in DB data, so subtract 1 day for human display.
  const displayEnd = new Date(endExclusive.getTime() - 24 * 60 * 60 * 1000);
  const startLabel = start.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  const endLabel = displayEnd.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  return `${startLabel} - ${endLabel}`;
}

function formatHours(seconds: number, decimals = 1): string {
  return (seconds / 3600).toFixed(decimals);
}

function formatDurationCompact(seconds: number): string {
  const totalMinutes = Math.max(0, Math.round(seconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

function calculateComfortScore(tempC: number, humidityRh: number): number {
  const tempPenalty = Math.max(0, Math.abs(tempC - 22) * 8);
  const humidityPenalty = Math.max(0, Math.abs(humidityRh - 50) * 1.2);
  const score = Math.round(100 - tempPenalty - humidityPenalty);
  return Math.min(100, Math.max(0, score));
}

function buildTrend(
  current: number,
  previous: number | null,
  formatDelta: (value: number) => string,
  intent: TrendIntent = "direction",
): Pick<MetricData, "trend" | "trendText"> {
  if (previous === null) {
    return { trend: "neutral", trendText: "First recorded week" };
  }

  const delta = current - previous;
  const absDelta = Math.abs(delta);
  if (absDelta < 0.0001) {
    return { trend: "neutral", trendText: "Stable vs previous week" };
  }

  if (intent === "higher_is_better") {
    const improved = delta > 0;
    return {
      trend: improved ? "up" : "down",
      trendText: improved
        ? `Improved by ${formatDelta(absDelta)}`
        : `Dropped by ${formatDelta(absDelta)}`,
    };
  }

  if (intent === "lower_is_better") {
    const improved = delta < 0;
    return {
      trend: improved ? "up" : "down",
      trendText: improved
        ? `Improved by ${formatDelta(absDelta)}`
        : `Increased by ${formatDelta(absDelta)}`,
    };
  }

  return {
    trend: delta > 0 ? "up" : "down",
    trendText: `${delta > 0 ? "+" : "-"}${formatDelta(absDelta)} vs previous week`,
  };
}

function buildEnvironmentMetrics(
  latest: WeeklyReport,
  previous: WeeklyReport | null,
): MetricData[] {
  const latestComfort = calculateComfortScore(
    latest.avgRoomTemperatureC,
    latest.avgRoomHumidityRh,
  );
  const previousComfort =
    previous === null
      ? null
      : calculateComfortScore(previous.avgRoomTemperatureC, previous.avgRoomHumidityRh);

  return [
    {
      id: "env_temp",
      label: "Average Room Temperature",
      value: latest.avgRoomTemperatureC.toFixed(1),
      unit: "°C",
      icon: "thermometer-outline",
      iconColor: "#FF9800",
      backgroundColor: "#FFF3E0",
      ...buildTrend(
        latest.avgRoomTemperatureC,
        previous?.avgRoomTemperatureC ?? null,
        (delta) => `${delta.toFixed(1)}°C`,
      ),
    },
    {
      id: "env_humidity",
      label: "Average Room Humidity",
      value: latest.avgRoomHumidityRh.toFixed(1),
      unit: "%",
      icon: "water-outline",
      iconColor: "#2196F3",
      backgroundColor: "#E3F2FD",
      ...buildTrend(
        latest.avgRoomHumidityRh,
        previous?.avgRoomHumidityRh ?? null,
        (delta) => `${delta.toFixed(1)}%`,
      ),
    },
    {
      id: "env_comfort",
      label: "Nursery Comfort Score",
      value: `${latestComfort}`,
      unit: "/100",
      icon: "leaf-outline",
      iconColor: "#43A047",
      backgroundColor: "#E8F5E9",
      ...buildTrend(
        latestComfort,
        previousComfort,
        (delta) => `${Math.round(delta)} pts`,
        "higher_is_better",
      ),
    },
  ];
}

function buildBabyMetrics(latest: WeeklyReport, previous: WeeklyReport | null): MetricData[] {
  return [
    {
      id: "baby_sleep_total",
      label: "Total Sleep Duration",
      value: formatHours(latest.totalSleepDurationS),
      unit: "h",
      icon: "moon-outline",
      iconColor: "#5C6BC0",
      backgroundColor: "#E8EAF6",
      ...buildTrend(
        latest.totalSleepDurationS,
        previous?.totalSleepDurationS ?? null,
        (delta) => `${formatHours(delta, 1)}h`,
        "higher_is_better",
      ),
    },
    {
      id: "baby_cry_duration",
      label: "Total Cry Duration",
      value: formatHours(latest.totalCryDurationS, 2),
      unit: "h",
      icon: "volume-high-outline",
      iconColor: "#EF5350",
      backgroundColor: "#FFEBEE",
      ...buildTrend(
        latest.totalCryDurationS,
        previous?.totalCryDurationS ?? null,
        (delta) => `${formatHours(delta, 2)}h`,
        "lower_is_better",
      ),
    },
    {
      id: "baby_heart",
      label: "Average Heart Rate",
      value: latest.avgHeartRateBpm.toFixed(1),
      unit: "bpm",
      icon: "heart-outline",
      iconColor: "#EC407A",
      backgroundColor: "#FCE4EC",
      ...buildTrend(
        latest.avgHeartRateBpm,
        previous?.avgHeartRateBpm ?? null,
        (delta) => `${delta.toFixed(1)} bpm`,
      ),
    },
    {
      id: "baby_breathing",
      label: "Average Breathing Rate",
      value: latest.avgBreathingRateBpm.toFixed(1),
      unit: "bpm",
      icon: "fitness-outline",
      iconColor: "#26A69A",
      backgroundColor: "#E0F2F1",
      ...buildTrend(
        latest.avgBreathingRateBpm,
        previous?.avgBreathingRateBpm ?? null,
        (delta) => `${delta.toFixed(1)} bpm`,
      ),
    },
    {
      id: "baby_risky",
      label: "Risky Posture Events",
      value: `${latest.totalRiskyPostureEvents}`,
      icon: "alert-circle-outline",
      iconColor: "#FB8C00",
      backgroundColor: "#FFF3E0",
      ...buildTrend(
        latest.totalRiskyPostureEvents,
        previous?.totalRiskyPostureEvents ?? null,
        (delta) => `${Math.round(delta)} events`,
        "lower_is_better",
      ),
    },
  ];
}

function buildOverviewText(latest: WeeklyReport): string {
  return [
    `Sleep totaled ${formatHours(latest.totalSleepDurationS)}h across ${latest.totalSleepSessions} sessions (avg ${formatDurationCompact(latest.avgSleepDurationS)} per session).`,
    `Crying lasted ${formatDurationCompact(latest.totalCryDurationS)} from ${latest.totalCryEvents} events.`,
    `${latest.totalRiskyPostureEvents} risky posture alerts were recorded.`,
  ].join(" ");
}

function buildEnvironmentChartData(reports: WeeklyReport[]): ChartDataPoint[] {
  return reports.map((report) => ({
    time: formatWeekLabel(report.weekStart),
    value: Number(report.avgRoomTemperatureC.toFixed(2)),
  }));
}

function buildBabyChartData(reports: WeeklyReport[]): ChartDataPoint[] {
  return reports.map((report) => ({
    time: formatWeekLabel(report.weekStart),
    value: Number((report.totalSleepDurationS / 3600).toFixed(2)),
  }));
}

const AnalyticsScreen = () => {
  const [activeTab, setActiveTab] = useState<AnalyticsTab>("Environment");
  const { reports, isLoading, isRefreshing, error, refetch } = useAnalytics(WEEKS_TO_FETCH);

  const latestReport = reports.length > 0 ? reports[reports.length - 1] : null;
  const previousReport = reports.length > 1 ? reports[reports.length - 2] : null;

  const environmentMetrics = useMemo(
    () => (latestReport ? buildEnvironmentMetrics(latestReport, previousReport) : []),
    [latestReport, previousReport],
  );
  const babyMetrics = useMemo(
    () => (latestReport ? buildBabyMetrics(latestReport, previousReport) : []),
    [latestReport, previousReport],
  );

  const environmentChartData = useMemo(() => buildEnvironmentChartData(reports), [reports]);
  const babyChartData = useMemo(() => buildBabyChartData(reports), [reports]);

  const handleRefreshPress = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await refetch();
  };

  const refreshButton = (
    <TouchableOpacity style={styles.refreshButton} onPress={handleRefreshPress}>
      <Text style={styles.refreshButtonText}>{isRefreshing ? "Refreshing..." : "Refresh"}</Text>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header title="Analytics" rightComponent={refreshButton} />
        <View style={styles.centeredState}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.stateText}>Loading weekly analytics...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Analytics" rightComponent={refreshButton} />

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <TabSwitcher
            tabs={["Environment", "Baby"]}
            activeTab={activeTab}
            onTabChange={(tab) => setActiveTab(tab as AnalyticsTab)}
          />

          {error ? (
            <View style={styles.errorCard}>
              <Text style={styles.errorTitle}>Could not refresh analytics</Text>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {!latestReport ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No weekly report data yet</Text>
              <Text style={styles.emptyText}>
                Weekly summaries will appear here once your device uploads report rows.
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.overviewCard}>
                <Text style={styles.overviewLabel}>
                  Latest Week: {formatWeekRange(latestReport.weekStart, latestReport.weekEnd)}
                </Text>
                <Text style={styles.overviewText}>{buildOverviewText(latestReport)}</Text>
              </View>

              {(activeTab === "Environment" ? environmentMetrics : babyMetrics).map((metric) => (
                <MetricCard key={metric.id} metric={metric} />
              ))}

              <TemperatureChart
                title={
                  activeTab === "Environment"
                    ? "Room Temperature Trend"
                    : "Total Weekly Sleep Trend"
                }
                subtitle={`Based on ${reports.length} weekly report${reports.length === 1 ? "" : "s"}`}
                data={activeTab === "Environment" ? environmentChartData : babyChartData}
                lineColor={activeTab === "Environment" ? "#FF9800" : "#5C6BC0"}
                decimalPlaces={activeTab === "Environment" ? 1 : 2}
                yAxisSuffix={activeTab === "Environment" ? "°" : "h"}
              />
            </>
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
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: LAYOUT.spacing.md,
    paddingBottom: LAYOUT.spacing.lg,
  },
  refreshButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: LAYOUT.spacing.md,
    paddingVertical: LAYOUT.spacing.sm,
    borderRadius: LAYOUT.borderRadius.sm,
    minWidth: 86,
    alignItems: "center",
  },
  refreshButtonText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: "700",
  },
  centeredState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: LAYOUT.spacing.lg,
  },
  stateText: {
    marginTop: LAYOUT.spacing.md,
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: "center",
  },
  errorCard: {
    backgroundColor: "#FFEBEE",
    borderRadius: LAYOUT.borderRadius.md,
    padding: LAYOUT.spacing.md,
    marginBottom: LAYOUT.spacing.md,
    borderWidth: 1,
    borderColor: "#FFCDD2",
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#B71C1C",
    marginBottom: 4,
  },
  errorText: {
    fontSize: 12,
    color: "#C62828",
    lineHeight: 18,
  },
  emptyCard: {
    backgroundColor: COLORS.white,
    borderRadius: LAYOUT.borderRadius.md,
    padding: LAYOUT.spacing.md,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  overviewCard: {
    backgroundColor: "#EEF2FF",
    borderRadius: LAYOUT.borderRadius.md,
    padding: LAYOUT.spacing.md,
    marginBottom: LAYOUT.spacing.md,
    borderWidth: 1,
    borderColor: "#DDE4FF",
  },
  overviewLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#3949AB",
    marginBottom: 6,
  },
  overviewText: {
    fontSize: 13,
    color: COLORS.textPrimary,
    lineHeight: 20,
  },
});

export default AnalyticsScreen;
