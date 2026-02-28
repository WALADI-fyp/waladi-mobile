import { AnalyticsData } from "../types/analytics.types";
import { LiveMonitorData } from "../types/monitor.types";
import { BabyProfile } from "../types/profile.types";
import { Alert } from "../types/alert.types";

// Vital signs are now provided by the live SSE stream via useVitalSigns().
// Only the video/position data remains as dummy for now.

export const DUMMY_MONITOR_DATA: Omit<LiveMonitorData, "vitalSigns"> = {
  isLive: true,
  position: "Back Position",
  positionStatus: "safe",
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

export const DUMMY_BABY_PROFILE: BabyProfile = {
  id: "1",
  name: "Sleiman",
  age: "3 weeks old",
  birthDate: "Born: January 26, 2025",
  avatarUrl: undefined,
};

export const DUMMY_ALERTS: Alert[] = [
  {
    id: "1",
    title: "High Room Temperature",
    message:
      "Room temperature has risen to 28°C. Consider turning on the AC or fan to cool down the room.",
    severity: "warning",
    category: "temperature",
    status: "unread",
    timestamp: new Date(Date.now() - 5 * 60 * 1000), // 5 mins ago
    icon: "thermometer-outline",
  },
  {
    id: "2",
    title: "Baby Movement Detected",
    message:
      "Unusual movement detected. Baby may have changed sleeping position.",
    severity: "info",
    category: "movement",
    status: "unread",
    timestamp: new Date(Date.now() - 15 * 60 * 1000), // 15 mins ago
    icon: "body-outline",
  },
  {
    id: "3",
    title: "Low Humidity Alert",
    message:
      "Humidity dropped to 25%. Consider using a humidifier to maintain optimal levels.",
    severity: "warning",
    category: "humidity",
    status: "unread",
    timestamp: new Date(Date.now() - 30 * 60 * 1000), // 30 mins ago
    icon: "water-outline",
  },
  {
    id: "4",
    title: "Crying Detected",
    message: "Baby crying detected at 2:45 AM. Sound level was moderate.",
    severity: "info",
    category: "sound",
    status: "read",
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    icon: "volume-high-outline",
  },
  {
    id: "5",
    title: "Critical: High Body Temperature",
    message:
      "Baby's body temperature reached 38.5°C. Please check on baby immediately.",
    severity: "critical",
    category: "temperature",
    status: "read",
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
    icon: "thermometer-outline",
  },
  {
    id: "6",
    title: "Connection Lost",
    message: "Monitor connection was temporarily lost and has been restored.",
    severity: "info",
    category: "system",
    status: "read",
    timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
    icon: "wifi-outline",
  },
  {
    id: "7",
    title: "Breathing Pattern Change",
    message: "Slight change in breathing pattern detected. Currently stable.",
    severity: "warning",
    category: "breathing",
    status: "read",
    timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 hours ago
    icon: "fitness-outline",
  },
];
