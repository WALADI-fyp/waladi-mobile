import { useAuth } from "@clerk/clerk-expo";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ANALYTICS_URL } from "../services/backend/config";
import {
  AnalyticsApiResponse,
  WeeklyReport,
  WeeklyReportApiRow,
} from "../types/analytics.types";

const DEFAULT_WEEKS = 8;
const MAX_WEEKS = 52;

function parseNumber(value: number | string | null | undefined): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
}

function parseCount(value: number | string | null | undefined): number {
  return Math.max(0, Math.round(parseNumber(value)));
}

function mapApiRow(row: WeeklyReportApiRow): WeeklyReport {
  return {
    userId: row.user_id,
    deviceId: row.device_id,
    weekStart: row.week_start,
    weekEnd: row.week_end,
    avgHeartRateBpm: parseNumber(row.avg_heart_rate_bpm),
    avgBreathingRateBpm: parseNumber(row.avg_breathing_rate_bpm),
    avgRoomTemperatureC: parseNumber(row.avg_room_temperature_c),
    avgRoomHumidityRh: parseNumber(row.avg_room_humidity_rh),
    avgBodyTemperatureC: parseNumber(row.avg_body_temperature_c),
    totalCryEvents: parseCount(row.total_cry_events),
    totalCryDurationS: parseNumber(row.total_cry_duration_s),
    longestCryDurationS: parseNumber(row.longest_cry_duration_s),
    totalSleepSessions: parseCount(row.total_sleep_sessions),
    totalSleepDurationS: parseNumber(row.total_sleep_duration_s),
    avgSleepDurationS: parseNumber(row.avg_sleep_duration_s),
    longestSleepDurationS: parseNumber(row.longest_sleep_duration_s),
    totalRiskyPostureEvents: parseCount(row.total_risky_posture_events),
  };
}

export interface UseAnalyticsResult {
  reports: WeeklyReport[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useAnalytics(requestedWeeks: number = DEFAULT_WEEKS): UseAnalyticsResult {
  const { getToken } = useAuth();
  const [reports, setReports] = useState<WeeklyReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const weeks = useMemo(
    () => Math.min(Math.max(1, Math.round(requestedWeeks)), MAX_WEEKS),
    [requestedWeeks],
  );

  const fetchAnalytics = useCallback(
    async (refresh = false) => {
      if (refresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      try {
        const token = await getToken();
        if (!token) {
          throw new Error("Missing auth token. Please sign in again.");
        }

        const response = await fetch(`${ANALYTICS_URL}?weeks=${weeks}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          const body = await response.text().catch(() => "");
          const detail = body ? ` (${body.slice(0, 120)})` : "";
          throw new Error(`Analytics request failed with ${response.status}${detail}`);
        }

        const payload = (await response.json()) as AnalyticsApiResponse;
        const rows = Array.isArray(payload.weeks) ? payload.weeks : [];
        setReports(rows.map(mapApiRow));
      } catch (err: any) {
        const message =
          typeof err?.message === "string" && err.message.length > 0
            ? err.message
            : "Failed to load analytics.";
        setError(message);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [getToken, weeks],
  );

  useEffect(() => {
    void fetchAnalytics(false);
  }, [fetchAnalytics]);

  const refetch = useCallback(async () => {
    await fetchAnalytics(true);
  }, [fetchAnalytics]);

  return { reports, isLoading, isRefreshing, error, refetch };
}
