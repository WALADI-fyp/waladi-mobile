import { AnalyticsData } from "../types/analytics.types";
import { VitalSign, LiveMonitorData } from "../types/monitor.types";

export const DUMMY_VITAL_SIGNS: VitalSign[] = [
  {
    id: "1",
    label: "Body Temp",
    value: "36.8°C",
    status: "normal",
    icon: "thermometer-outline",
  },
  {
    id: "2",
    label: "Room Temp",
    value: "26.2°C",
    status: "warning",
    icon: "home-outline",
  },
  {
    id: "3",
    label: "Humidity",
    value: "28%",
    status: "warning",
    icon: "water-outline",
  },
  {
    id: "4",
    label: "Breathing Rate",
    value: "98%",
    status: "normal",
    icon: "fitness-outline",
  },
];

export const DUMMY_MONITOR_DATA: LiveMonitorData = {
  isLive: true,
  position: "Back Position",
  positionStatus: "safe",
  vitalSigns: DUMMY_VITAL_SIGNS,
};

export const DUMMY_ANALYTICS_DATA: AnalyticsData = {
  environment: {
    metrics: [
      {
        id: "1",
        label: "Average Room Temperature",
        value: "72",
        unit: "°F",
        trend: "up",
        trendText: "From yesterday",
        icon: "thermometer-outline",
        iconColor: "#FF9800",
        backgroundColor: "#FFF3E0",
      },
      {
        id: "2",
        label: "Average Humidity",
        value: "45",
        unit: "%",
        trend: "down",
        trendText: "From yesterday",
        icon: "water-outline",
        iconColor: "#2196F3",
        backgroundColor: "#E3F2FD",
      },
      {
        id: "3",
        label: "Air Quality",
        value: "Good",
        status: "good",
        trendText: "Optimal level",
        icon: "leaf-outline",
        iconColor: "#4CAF50",
        backgroundColor: "#E8F5E9",
      },
    ],
    chartData: [
      { time: "12AM", value: 20 },
      { time: "3AM", value: 30 },
      { time: "6AM", value: 35 },
      { time: "9AM", value: 45 },
      { time: "12PM", value: 50 },
      { time: "3PM", value: 55 },
      { time: "6PM", value: 40 },
      { time: "9PM", value: 30 },
    ],
  },
  baby: {
    metrics: [
      {
        id: "1",
        label: "Average Body Temperature",
        value: "36.8",
        unit: "°C",
        trend: "neutral",
        trendText: "Normal range",
        icon: "thermometer-outline",
        iconColor: "#4CAF50",
        backgroundColor: "#E8F5E9",
      },
      {
        id: "2",
        label: "Sleep Quality",
        value: "92",
        unit: "%",
        trend: "up",
        trendText: "From last week",
        icon: "moon-outline",
        iconColor: "#6C63FF",
        backgroundColor: "#EDE7F6",
      },
      {
        id: "3",
        label: "Activity Level",
        value: "Moderate",
        status: "good",
        trendText: "Healthy range",
        icon: "fitness-outline",
        iconColor: "#FF9800",
        backgroundColor: "#FFF3E0",
      },
    ],
    chartData: [
      { time: "12AM", value: 36 },
      { time: "3AM", value: 37 },
      { time: "6AM", value: 38 },
      { time: "9AM", value: 40 },
      { time: "12PM", value: 42 },
      { time: "3PM", value: 41 },
      { time: "6PM", value: 39 },
      { time: "9PM", value: 37 },
    ],
  },
};
