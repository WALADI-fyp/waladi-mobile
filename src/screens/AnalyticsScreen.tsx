import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Text,
} from "react-native";
import { COLORS, LAYOUT } from "../constants";
import { DUMMY_ANALYTICS_DATA } from "../constants/dummy-data";
import Header from "../components/common/Header";
import TabSwitcher from "../components/common/TabSwitcher";
import MetricCard from "../components/analytics/MetricCard";
import TemperatureChart from "../components/analytics/TemperatureChart";

const AnalyticsScreen = () => {
  const [activeTab, setActiveTab] = useState<"Environment" | "Baby">(
    "Environment"
  );

  const handleExportPress = () => {
    console.log("Export pressed");
  };

  const currentData =
    activeTab === "Environment"
      ? DUMMY_ANALYTICS_DATA.environment
      : DUMMY_ANALYTICS_DATA.baby;

  // Export button component
  const ExportButton = (
    <TouchableOpacity style={styles.exportButton} onPress={handleExportPress}>
      <Text style={styles.exportText}>Export</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Analytics" rightComponent={ExportButton} />

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <TabSwitcher
            tabs={["Environment", "Baby"]}
            activeTab={activeTab}
            onTabChange={(tab) => setActiveTab(tab as "Environment" | "Baby")}
          />

          {currentData.metrics.map((metric) => (
            <MetricCard key={metric.id} metric={metric} />
          ))}

          <TemperatureChart
            title={
              activeTab === "Environment"
                ? "Room Temperature (24h)"
                : "Body Temperature (24h)"
            }
            data={currentData.chartData}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  exportButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: LAYOUT.spacing.md,
    paddingVertical: LAYOUT.spacing.sm,
    borderRadius: LAYOUT.borderRadius.sm,
  },
  exportText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: "600",
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: LAYOUT.spacing.md,
  },
});

export default AnalyticsScreen;
