import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, LAYOUT } from "../../constants";
import { MetricData } from "../../types/analytics.types";

interface MetricCardProps {
  metric: MetricData;
}

const MetricCard: React.FC<MetricCardProps> = ({ metric }) => {
  const getTrendIcon = () => {
    if (metric.trend === "up") return "arrow-up";
    if (metric.trend === "down") return "arrow-down";
    return "checkmark-circle";
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>{metric.label}</Text>
        <View
          style={[
            styles.iconContainer,
            { backgroundColor: metric.backgroundColor },
          ]}
        >
          <Ionicons
            name={metric.icon as keyof typeof Ionicons.glyphMap}
            size={18}
            color={metric.iconColor}
          />
        </View>
      </View>

      <View style={styles.valueContainer}>
        <Text style={styles.value}>
          {metric.value}
          {metric.unit && <Text style={styles.unit}>{metric.unit}</Text>}
        </Text>
      </View>

      {metric.trendText && (
        <View style={styles.trendContainer}>
          <Ionicons
            name={getTrendIcon() as keyof typeof Ionicons.glyphMap}
            size={12}
            color={COLORS.textSecondary}
          />
          <Text style={styles.trendText}>{metric.trendText}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.white,
    borderRadius: LAYOUT.borderRadius.md,
    padding: LAYOUT.spacing.md,
    paddingVertical: LAYOUT.spacing.sm,
    marginBottom: LAYOUT.spacing.md,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: LAYOUT.spacing.sm,
  },
  label: {
    fontSize: 13,
    color: COLORS.textSecondary,
    flex: 1,
    marginRight: LAYOUT.spacing.sm,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: LAYOUT.borderRadius.sm,
    justifyContent: "center",
    alignItems: "center",
  },
  valueContainer: {
    marginBottom: 4,
  },
  value: {
    fontSize: 28,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  unit: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  trendContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  trendText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginLeft: 4,
  },
});

export default MetricCard;
