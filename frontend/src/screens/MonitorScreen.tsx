import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, SafeAreaView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, LAYOUT } from "../constants";
import { DUMMY_MONITOR_DATA } from "../constants/dummy-data";
import Header from "../components/common/Header";
import LiveVideoPlayer from "../components/monitor/LiveVideoPlayer";
import VitalSignCard from "../components/monitor/VitalSignCard";
import FullScreenVideoModal from "../components/monitor/FullScreenVideoModal";
import AnimatedCard from "../components/common/AnimatedCard";
import { useVitalSigns } from "../hooks/useVitalSigns";
import * as Haptics from "expo-haptics";
import { connectToAiPoseStream } from "../services/backend/aiPoseClient";

const MonitorScreen = () => {
  const [isFullScreenVisible, setIsFullScreenVisible] = useState(false);
  const [isRiskyPose, setIsRiskyPose] = useState(false);
  const { vitalSigns, isConnected, isStale, error } = useVitalSigns();

  const handleFullScreen = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsFullScreenVisible(true);
  };

  const handleCloseFullScreen = () => {
    setIsFullScreenVisible(false);
  };

  const handleSettingsPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    console.log("Settings pressed");
  };

  useEffect(() => {
    const disconnect = connectToAiPoseStream(
      (payload) => {
        setIsRiskyPose(payload.data?.is_risky === true);
      },
      (err) => {
        console.error("[MonitorScreen] ai pose stream error:", err.message);
      },
    );

    return () => {
      disconnect();
    };
  }, []);

  const postureLabel = isRiskyPose
    ? "Posture needs attention"
    : "Posture looks safe";
  const postureStatus = isRiskyPose ? "danger" : "safe";

  // Connection status display
  const getConnectionStatus = () => {
    if (error)
      return {
        color: COLORS.error,
        text: "Error",
        icon: "alert-circle" as const,
      };
    if (isStale)
      return { color: COLORS.warning, text: "Stale", icon: "warning" as const };
    if (isConnected)
      return { color: COLORS.success, text: "Live", icon: "radio" as const };
    return {
      color: COLORS.gray,
      text: "Connecting…",
      icon: "ellipsis-horizontal-circle" as const,
    };
  };

  const connectionStatus = getConnectionStatus();

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="Live Monitor"
        rightIcon="settings-outline"
        onRightPress={handleSettingsPress}
      />

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <AnimatedCard delay={0}>
            <LiveVideoPlayer
              isLive={DUMMY_MONITOR_DATA.isLive}
              position={postureLabel}
              positionStatus={postureStatus}
              onFullScreenPress={handleFullScreen}
            />
          </AnimatedCard>

          {/* Connection status + Vital Signs header */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Vital Signs</Text>
            <View style={styles.connectionBadge}>
              <Ionicons
                name={connectionStatus.icon}
                size={14}
                color={connectionStatus.color}
              />
              <Text
                style={[
                  styles.connectionText,
                  { color: connectionStatus.color },
                ]}
              >
                {connectionStatus.text}
              </Text>
            </View>
          </View>

          {/* Error banner */}
          {error && (
            <View style={styles.errorBanner}>
              <Ionicons
                name="alert-circle-outline"
                size={16}
                color={COLORS.error}
              />
              <Text style={styles.errorText} numberOfLines={2}>
                {error}
              </Text>
            </View>
          )}

          {/* Vital Signs Grid */}
          {vitalSigns.length > 0 ? (
            <View style={styles.vitalSignsGrid}>
              {vitalSigns.map((vitalSign, index) => (
                <View key={vitalSign.id} style={styles.vitalSignCard}>
                  <AnimatedCard delay={100 + index * 100}>
                    <VitalSignCard vitalSign={vitalSign} />
                  </AnimatedCard>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.loadingContainer}>
              <Ionicons name="pulse-outline" size={32} color={COLORS.gray} />
              <Text style={styles.loadingText}>
                {error
                  ? "Unable to connect to sensor"
                  : "Waiting for sensor data…"}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Full Screen Video Modal */}
      <FullScreenVideoModal
        visible={isFullScreenVisible}
        isLive={DUMMY_MONITOR_DATA.isLive}
        isRisky={isRiskyPose}
        position={postureLabel}
        onClose={handleCloseFullScreen}
      />
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
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: LAYOUT.spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.textPrimary,
  },
  connectionBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.lightGray,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  connectionText: {
    fontSize: 12,
    fontWeight: "600",
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFEBEE",
    padding: LAYOUT.spacing.sm,
    borderRadius: LAYOUT.borderRadius.sm,
    marginBottom: LAYOUT.spacing.md,
    gap: 8,
  },
  errorText: {
    fontSize: 12,
    color: COLORS.error,
    flex: 1,
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
  loadingContainer: {
    alignItems: "center",
    paddingVertical: LAYOUT.spacing.xl * 2,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
});

export default MonitorScreen;
