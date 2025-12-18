export interface VitalSign {
  id: string;
  label: string;
  value: string;
  status: "normal" | "warning" | "critical";
  icon: string;
}

export interface LiveMonitorData {
  isLive: boolean;
  position: string;
  positionStatus: "safe" | "warning" | "danger";
  vitalSigns: VitalSign[];
}
