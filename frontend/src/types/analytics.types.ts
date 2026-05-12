export interface MetricData {
  id: string;
  label: string;
  value: string;
  unit?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendText?: string;
  status?: 'good' | 'warning' | 'danger';
  icon: string;
  iconColor: string;
  backgroundColor: string;
}

export interface ChartDataPoint {
  time: string;
  value: number;
}

export interface WeeklyReportApiRow {
  user_id: string;
  device_id: string;
  week_start: string;
  week_end: string;
  avg_heart_rate_bpm: number | string | null;
  avg_breathing_rate_bpm: number | string | null;
  avg_room_temperature_c: number | string | null;
  avg_room_humidity_rh: number | string | null;
  avg_body_temperature_c: number | string | null;
  total_cry_events: number | string | null;
  total_cry_duration_s: number | string | null;
  longest_cry_duration_s: number | string | null;
  total_sleep_sessions: number | string | null;
  total_sleep_duration_s: number | string | null;
  avg_sleep_duration_s: number | string | null;
  longest_sleep_duration_s: number | string | null;
  total_risky_posture_events: number | string | null;
  created_at?: string;
}

export interface WeeklyReport {
  userId: string;
  deviceId: string;
  weekStart: string;
  weekEnd: string;
  avgHeartRateBpm: number;
  avgBreathingRateBpm: number;
  avgRoomTemperatureC: number;
  avgRoomHumidityRh: number;
  avgBodyTemperatureC: number;
  totalCryEvents: number;
  totalCryDurationS: number;
  longestCryDurationS: number;
  totalSleepSessions: number;
  totalSleepDurationS: number;
  avgSleepDurationS: number;
  longestSleepDurationS: number;
  totalRiskyPostureEvents: number;
}

export interface AnalyticsApiResponse {
  weeks: WeeklyReportApiRow[];
  total_weeks: number;
  requested_weeks: number;
  device_id: string | null;
}

export interface AnalyticsData {
  environment: {
    metrics: MetricData[];
    chartData: ChartDataPoint[];
  };
  baby: {
    metrics: MetricData[];
    chartData: ChartDataPoint[];
  };
}
