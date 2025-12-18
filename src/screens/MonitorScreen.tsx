import React from "react";
import { View, Text, StyleSheet, ScrollView, SafeAreaView } from "react-native";
import { COLORS, LAYOUT } from "../constants";
import { DUMMY_MONITOR_DATA } from "../constants/dummy-data";
import Header from "../components/common/Header";
import LiveVideoPlayer from "../components/monitor/LiveVideoPlayer";
import VitalSignCard from "../components/monitor/VitalSignCard";

const MonitorScreen = () => {
  const handleFullScreen = () => {
    console.log("Full screen pressed");
  };

  const handleSettingsPress = () => {
    console.log("Settings pressed");
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="Live Monitor"
        rightIcon="settings-outline"
        onRightPress={handleSettingsPress}
      />

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <LiveVideoPlayer
            isLive={DUMMY_MONITOR_DATA.isLive}
            position={DUMMY_MONITOR_DATA.position}
            positionStatus={DUMMY_MONITOR_DATA.positionStatus}
            onFullScreenPress={handleFullScreen}
          />

          <Text style={styles.sectionTitle}>Vital Signs</Text>

          <View style={styles.vitalSignsGrid}>
            {DUMMY_MONITOR_DATA.vitalSigns.map((vitalSign) => (
              <View key={vitalSign.id} style={styles.vitalSignCard}>
                <VitalSignCard vitalSign={vitalSign} />
              </View>
            ))}
          </View>
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
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: LAYOUT.spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.textPrimary,
    marginBottom: LAYOUT.spacing.md,
  },
  vitalSignsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -LAYOUT.spacing.xs,
  },
  vitalSignCard: {
    width: "50%",
    padding: LAYOUT.spacing.xs,
  },
});

export default MonitorScreen;
