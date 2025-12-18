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
