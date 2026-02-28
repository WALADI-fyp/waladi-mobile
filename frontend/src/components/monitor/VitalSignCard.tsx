import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, LAYOUT } from "../../constants";
import { VitalSign } from "../../types/monitor.types";

interface VitalSignCardProps {
  vitalSign: VitalSign;
}

const VitalSignCard: React.FC<VitalSignCardProps> = ({ vitalSign }) => {
  const getStatusInfo = (status: VitalSign["status"]) => {
    switch (status) {
      case "normal":
        return { color: COLORS.success, text: "Normal" };
      case "warning":
        return { color: COLORS.warning, text: "Warning" };
      case "critical":
        return { color: COLORS.low, text: "Critical" };
      default:
        return { color: COLORS.gray, text: "Unknown" };
    }
  };

  const { color: statusColor, text: statusText } = getStatusInfo(
    vitalSign.status,
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons
          name={vitalSign.icon as keyof typeof Ionicons.glyphMap}
          size={20}
          color={statusColor}
        />
        <View style={styles.headerRight}>
          <Text style={[styles.status, { color: statusColor }]}>
            {statusText}
          </Text>
        </View>
      </View>

      <Text style={styles.label}>{vitalSign.label}</Text>
      <View style={styles.valueRow}>
        <Text style={styles.value}>{vitalSign.value}</Text>
        {vitalSign.unit && <Text style={styles.unit}>{vitalSign.unit}</Text>}
      </View>

      <View style={styles.progressBarContainer}>
        <View
          style={[
            styles.progressBar,
            {
              backgroundColor: statusColor,
              width: "80%",
            },
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
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
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
  valueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: LAYOUT.spacing.sm,
  },
  value: {
    fontSize: 24,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  unit: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.textSecondary,
    marginLeft: 3,
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
