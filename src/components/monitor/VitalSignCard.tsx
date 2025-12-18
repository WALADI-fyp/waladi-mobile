import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, LAYOUT } from "../../constants";
import { VitalSign } from "../../types/monitor.types";

interface VitalSignCardProps {
  vitalSign: VitalSign;
}

const VitalSignCard: React.FC<VitalSignCardProps> = ({ vitalSign }) => {
  const getStatusColor = (status: VitalSign["status"]) => {
    switch (status) {
      case "normal":
        return COLORS.success;
      case "warning":
        return COLORS.warning;
      case "critical":
        return COLORS.low;
      default:
        return COLORS.gray;
    }
  };

  const getStatusText = (status: VitalSign["status"]) => {
    switch (status) {
      case "normal":
        return "Normal";
      case "warning":
        return "Warning";
      case "critical":
        return "Critical";
      default:
        return "Unknown";
    }
  };

  const statusColor = getStatusColor(vitalSign.status);
  const statusText = getStatusText(vitalSign.status);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons
          name={vitalSign.icon as keyof typeof Ionicons.glyphMap}
          size={20}
          color={statusColor}
        />
        <Text style={[styles.status, { color: statusColor }]}>
          {statusText}
        </Text>
      </View>

      <Text style={styles.label}>{vitalSign.label}</Text>
      <Text style={styles.value}>{vitalSign.value}</Text>

      <View style={styles.progressBarContainer}>
        <View
          style={[
            styles.progressBar,
            { backgroundColor: statusColor, width: "80%" },
          ]}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.white,
    borderRadius: LAYOUT.borderRadius.md,
    padding: LAYOUT.spacing.md,
    flex: 1,
    minWidth: 150,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: LAYOUT.spacing.sm,
  },
  status: {
    fontSize: 12,
    fontWeight: "600",
  },
  label: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: LAYOUT.spacing.xs,
  },
  value: {
    fontSize: 24,
    fontWeight: "700",
    color: COLORS.textPrimary,
    marginBottom: LAYOUT.spacing.sm,
  },
  progressBarContainer: {
    height: 4,
    backgroundColor: COLORS.lightGray,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    borderRadius: 2,
  },
});

export default VitalSignCard;
