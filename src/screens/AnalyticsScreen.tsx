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

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Custom Header with Export Button */}
      <View style={styles.headerContainer}>
        <View style={styles.headerContent}>
          <View style={styles.leftSection} />

          <Text style={styles.headerTitle}>Analytics</Text>

          <View style={styles.rightSection}>
            <TouchableOpacity
              style={styles.exportButton}
              onPress={handleExportPress}
            >
              <Text style={styles.exportText}>Export</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

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
  headerContainer: {
    backgroundColor: COLORS.white,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: LAYOUT.spacing.md,
    paddingVertical: LAYOUT.spacing.md,
    backgroundColor: COLORS.white,
  },
  leftSection: {
    width: 40,
  },
  rightSection: {
    width: "auto",
    alignItems: "flex-end",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.textPrimary,
    flex: 1,
    textAlign: "center",
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
