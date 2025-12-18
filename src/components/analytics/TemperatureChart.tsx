import React from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";
import { LineChart } from "react-native-chart-kit";
import { COLORS, LAYOUT } from "../../constants";
import { ChartDataPoint } from "../../types/analytics.types";

interface TemperatureChartProps {
  title: string;
  data: ChartDataPoint[];
}

const TemperatureChart: React.FC<TemperatureChartProps> = ({ title, data }) => {
  const screenWidth = Dimensions.get("window").width - LAYOUT.spacing.md * 2;

  const chartData = {
    labels: data.map((point) => point.time),
    datasets: [
      {
        data: data.map((point) => point.value),
        color: (opacity = 1) => `rgba(255, 152, 0, ${opacity})`, // Orange color
        strokeWidth: 2,
      },
    ],
  };

  const chartConfig = {
    backgroundColor: COLORS.white,
    backgroundGradientFrom: COLORS.white,
    backgroundGradientTo: COLORS.white,
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(255, 152, 0, ${opacity})`,
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

      <LineChart
        data={chartData}
        width={screenWidth - LAYOUT.spacing.md * 2}
        height={180}
        chartConfig={chartConfig}
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
    marginBottom: LAYOUT.spacing.sm,
  },
  chart: {
    marginVertical: LAYOUT.spacing.sm,
    borderRadius: LAYOUT.borderRadius.md,
  },
});

export default TemperatureChart;
