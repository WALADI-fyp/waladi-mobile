export type AlertSeverity = 'critical' | 'warning' | 'info';
export type AlertCategory = 'temperature' | 'humidity' | 'movement' | 'sound' | 'sleep' | 'breathing' | 'system';
export type AlertStatus = 'unread' | 'read' | 'dismissed';

export interface Alert {
  id: string;
  title: string;
  message: string;
  severity: AlertSeverity;
  category: AlertCategory;
  status: AlertStatus;
  timestamp: Date;
  icon: string;
  deviceId?: string;
  alertId?: string;
  startedAt?: Date;
  endedAt?: Date | null;
  isActive?: boolean;
  startProb?: number;
  endProb?: number;
}

export interface AlertsData {
  alerts: Alert[];
  unreadCount: number;
}
