import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, LAYOUT } from "../../constants";
import { Alert } from "../../types/alert.types";

interface AlertItemProps {
  alert: Alert;
  onPress: (alert: Alert) => void;
  onDismiss?: (alert: Alert) => void;
}

const SEVERITY_CONFIG = {
  critical: {
    color: COLORS.error,
    backgroundColor: "#FFEBEE",
    icon: "alert-circle",
  },
  warning: {
    color: COLORS.warning,
    backgroundColor: "#FFF3E0",
    icon: "warning",
  },
  info: {
    color: COLORS.info,
    backgroundColor: "#E3F2FD",
    icon: "information-circle",
  },
} as const;

const CATEGORY_ICONS: Record<string, string> = {
  temperature: "thermometer-outline",
  humidity: "water-outline",
  movement: "body-outline",
  sound: "volume-high-outline",
  sleep: "moon-outline",
  breathing: "fitness-outline",
  system: "settings-outline",
};

const AlertItem: React.FC<AlertItemProps> = ({ alert, onPress, onDismiss }) => {
  const config = SEVERITY_CONFIG[alert.severity];
  const categoryIcon = CATEGORY_ICONS[alert.category] || "notifications-outline";

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  };

  return (
    <TouchableOpacity
      style={[
        styles.container,
        alert.status === "unread" && styles.unreadContainer,
      ]}
      onPress={() => onPress(alert)}
      activeOpacity={0.7}
    >
      <View
        style={[
          styles.iconContainer,
          { backgroundColor: config.backgroundColor },
        ]}
      >
        <Ionicons
          name={categoryIcon as keyof typeof Ionicons.glyphMap}
          size={24}
          color={config.color}
        />
      </View>

      <View style={styles.content}>
        <View style={styles.header}>
          <Text
            style={[
              styles.title,
              alert.status === "unread" && styles.unreadTitle,
            ]}
          >
            {alert.title}
          </Text>
          <View style={styles.timeContainer}>
            {alert.status === "unread" && <View style={styles.unreadDot} />}
            <Text style={styles.time}>{formatTime(alert.timestamp)}</Text>
          </View>
        </View>

        <Text style={styles.message}>
          {alert.message}
        </Text>

        <View style={styles.footer}>
          <View
            style={[styles.severityBadge, { backgroundColor: config.backgroundColor }]}
          >
            <Ionicons
              name={config.icon as keyof typeof Ionicons.glyphMap}
              size={12}
              color={config.color}
            />
            <Text style={[styles.severityText, { color: config.color }]}>
              {alert.severity.charAt(0).toUpperCase() + alert.severity.slice(1)}
            </Text>
          </View>
        </View>
      </View>

      {onDismiss && (
        <TouchableOpacity
          style={styles.dismissButton}
          onPress={() => onDismiss(alert)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close" size={18} color={COLORS.gray} />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    padding: LAYOUT.spacing.md,
    backgroundColor: COLORS.white,
    borderRadius: LAYOUT.borderRadius.md,
    marginBottom: LAYOUT.spacing.sm,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  unreadContainer: {
    backgroundColor: "#FAFBFF",
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: LAYOUT.borderRadius.sm,
    justifyContent: "center",
    alignItems: "center",
    marginRight: LAYOUT.spacing.md,
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: "500",
    color: COLORS.textPrimary,
    flex: 1,
    marginRight: LAYOUT.spacing.sm,
  },
  unreadTitle: {
    fontWeight: "700",
  },
  timeContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
    marginRight: 6,
  },
  time: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  message: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
    marginBottom: LAYOUT.spacing.xs,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
  },
  severityBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  severityText: {
    fontSize: 11,
    fontWeight: "600",
    marginLeft: 4,
  },
  dismissButton: {
    padding: LAYOUT.spacing.xs,
    marginLeft: LAYOUT.spacing.xs,
  },
});

export default AlertItem;
