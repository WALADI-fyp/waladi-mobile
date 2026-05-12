import React from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";
import { LineChart } from "react-native-chart-kit";
import { COLORS, LAYOUT } from "../../constants";
import { ChartDataPoint } from "../../types/analytics.types";

interface TemperatureChartProps {
  title: string;
  subtitle?: string;
  data: ChartDataPoint[];
  lineColor?: string;
  decimalPlaces?: number;
  yAxisSuffix?: string;
}

const TemperatureChart: React.FC<TemperatureChartProps> = ({
  title,
  subtitle,
  data,
  lineColor = "#FF9800",
  decimalPlaces = 1,
  yAxisSuffix = "",
}) => {
  const screenWidth = Dimensions.get("window").width - LAYOUT.spacing.md * 2;
  const safeData = data.length > 0 ? data : [{ time: "-", value: 0 }];

  const chartData = {
    labels: safeData.map((point) => point.time),
    datasets: [
      {
        data: safeData.map((point) => point.value),
        color: (opacity = 1) => {
          const hex = lineColor.replace("#", "");
          if (hex.length !== 6) return `rgba(255, 152, 0, ${opacity})`;
          const r = parseInt(hex.slice(0, 2), 16);
          const g = parseInt(hex.slice(2, 4), 16);
          const b = parseInt(hex.slice(4, 6), 16);
          return `rgba(${r}, ${g}, ${b}, ${opacity})`;
        },
        strokeWidth: 2,
      },
    ],
  };

  const chartConfig = {
    backgroundColor: COLORS.white,
    backgroundGradientFrom: COLORS.white,
    backgroundGradientTo: COLORS.white,
    decimalPlaces,
    color: (opacity = 1) => chartData.datasets[0].color(opacity),
    labelColor: (opacity = 1) => `rgba(117, 117, 117, ${opacity})`,
    style: {
      borderRadius: LAYOUT.borderRadius.md,
    },
    propsForDots: {
      r: "4",
      strokeWidth: "2",
      stroke: COLORS.white,
    },
    propsForBackgroundLines: {
      strokeDasharray: "", // solid background lines
      stroke: COLORS.lightGray,
      strokeWidth: 1,
    },
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

      {data.length === 0 ? (
        <Text style={styles.emptyText}>No weekly chart data yet.</Text>
      ) : null}

      <LineChart
        data={chartData}
        width={screenWidth - LAYOUT.spacing.md * 2}
        height={180}
        chartConfig={chartConfig}
        yAxisSuffix={yAxisSuffix}
        bezier
        style={styles.chart}
        withInnerLines={true}
        withOuterLines={false}
        withVerticalLabels={true}
        withHorizontalLabels={true}
        withVerticalLines={false}
        withHorizontalLines={true}
        withDots={true}
        withShadow={false}
        fromZero={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.white,
    borderRadius: LAYOUT.borderRadius.md,
    padding: LAYOUT.spacing.md,
    marginBottom: LAYOUT.spacing.md,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.textPrimary,
  },
  subtitle: {
    marginTop: 2,
    marginBottom: LAYOUT.spacing.xs,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  emptyText: {
    marginTop: LAYOUT.spacing.sm,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  chart: {
    marginVertical: LAYOUT.spacing.sm,
    borderRadius: LAYOUT.borderRadius.md,
  },
});

export default TemperatureChart;
