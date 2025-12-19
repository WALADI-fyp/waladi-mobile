export type AlertSeverity = 'critical' | 'warning' | 'info';
export type AlertCategory = 'temperature' | 'humidity' | 'movement' | 'sound' | 'breathing' | 'system';
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
}

export interface AlertsData {
  alerts: Alert[];
  unreadCount: number;
}
