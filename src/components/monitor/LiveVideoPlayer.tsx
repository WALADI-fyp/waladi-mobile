import React from "react";
import { View, Text, StyleSheet, Image, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, LAYOUT } from "../../constants";
import PulseView from "../common/PulseView";

interface LiveVideoPlayerProps {
  isLive: boolean;
  position: string;
  positionStatus: "safe" | "warning" | "danger";
  onFullScreenPress: () => void;
}

const LiveVideoPlayer: React.FC<LiveVideoPlayerProps> = ({
  isLive,
  position,
  positionStatus,
  onFullScreenPress,
}) => {
  const getStatusColor = () => {
    switch (positionStatus) {
      case "safe":
        return COLORS.success;
      case "warning":
        return COLORS.warning;
      case "danger":
        return COLORS.error;
      default:
        return COLORS.gray;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Live Preview</Text>
        {isLive && (
          <View style={styles.liveIndicator}>
            <PulseView color={COLORS.error}>
              <View style={styles.liveDot} />
            </PulseView>
            <Text style={styles.liveText}>Live</Text>
          </View>
        )}
      </View>

      <View style={styles.videoContainer}>
        <Image
          source={{ uri: "https://via.placeholder.com/400x250" }}
          style={styles.videoPlaceholder}
          resizeMode="cover"
        />
      </View>

      <View style={styles.footer}>
        <View style={styles.positionContainer}>
          <Ionicons
            name="checkmark-circle"
            size={16}
            color={getStatusColor()}
          />
          <Text style={styles.positionText}>
            Safe - <Text style={styles.positionBold}>{position}</Text>
          </Text>
        </View>

        <TouchableOpacity
          style={styles.fullScreenButton}
          onPress={onFullScreenPress}
        >
          <Text style={styles.fullScreenText}>View Full Screen</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.white,
    borderRadius: LAYOUT.borderRadius.lg,
    padding: LAYOUT.spacing.md,
    marginBottom: LAYOUT.spacing.lg,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 5,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: LAYOUT.spacing.md,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.textPrimary,
  },
  liveIndicator: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFE5E5",
    paddingHorizontal: LAYOUT.spacing.sm,
    paddingVertical: 4,
    borderRadius: LAYOUT.borderRadius.sm,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.error,
    marginRight: 4,
  },
  liveText: {
    fontSize: 12,
    color: COLORS.error,
    fontWeight: "600",
    marginLeft: 4,
  },
  videoContainer: {
    borderRadius: LAYOUT.borderRadius.md,
    overflow: "hidden",
    marginBottom: LAYOUT.spacing.md,
    backgroundColor: COLORS.lightGray,
  },
  videoPlaceholder: {
    width: "100%",
    height: 200,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  positionContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  positionText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginLeft: 4,
  },
  positionBold: {
    fontWeight: "600",
    color: COLORS.textPrimary,
  },
  fullScreenButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: LAYOUT.spacing.md,
    paddingVertical: LAYOUT.spacing.sm,
    borderRadius: LAYOUT.borderRadius.sm,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  fullScreenText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: "600",
  },
});

export default LiveVideoPlayer;
