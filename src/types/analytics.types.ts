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