export interface VitalSign {
  id: string;
  label: string;
  value: string;
  unit?: string;
  status: "normal" | "warning" | "critical";
  icon: string;
  isMock?: boolean;
}

export interface LiveMonitorData {
  isLive: boolean;
  position: string;
  positionStatus: "safe" | "warning" | "danger";
  vitalSigns: VitalSign[];
}
