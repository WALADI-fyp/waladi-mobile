import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Image,
  Dimensions,
  StatusBar,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, LAYOUT } from "../../constants";
import PulseView from "../common/PulseView";
import * as Haptics from "expo-haptics";
import { MediaService } from "../../services/media.service";
import CameraStream from "./CameraStream";

interface FullScreenVideoModalProps {
  visible: boolean;
  isLive: boolean;
  position: string;
  onClose: () => void;
}

const { width, height } = Dimensions.get("window");

const FullScreenVideoModal: React.FC<FullScreenVideoModalProps> = ({
  visible,
  isLive,
  position,
  onClose,
}) => {
  const scaleAnim = new Animated.Value(0.8);
  const fadeAnim = new Animated.Value(0);
  const viewRef = useRef(null);

  const [isRecording, setIsRecording] = useState(false);
  const [isTalking, setIsTalking] = useState(false);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0.8);
      fadeAnim.setValue(0);
      // Stop recording and talk back when modal closes
      if (isRecording) {
        handleStopRecording();
      }
      if (isTalking) {
        handleStopTalkBack();
      }
    }
  }, [visible]);

  useEffect(() => {
    return () => {
      // Cleanup when component unmounts
      if (isRecording) {
        MediaService.stopScreenRecording();
      }
      if (isTalking) {
        MediaService.stopTalkBack();
      }
    };
  }, [isRecording, isTalking]);

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onClose();
  };

  const handleSnapshot = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await MediaService.takeSnapshot(viewRef);
  };

  const handleToggleRecording = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (isRecording) {
      await handleStopRecording();
    } else {
      await handleStartRecording();
    }
  };

  const handleStartRecording = async () => {
    const success = await MediaService.startScreenRecording();
    if (success) {
      setIsRecording(true);
    }
  };

  const handleStopRecording = async () => {
    const success = await MediaService.stopScreenRecording();
    if (success) {
      setIsRecording(false);
    }
  };

  const handleToggleTalkBack = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (isTalking) {
      await handleStopTalkBack();
    } else {
      await handleStartTalkBack();
    }
  };

  const handleStartTalkBack = async () => {
    const success = await MediaService.startTalkBack();
    setIsTalking(success);
  };

  const handleStopTalkBack = async () => {
    const success = await MediaService.stopTalkBack();
    setIsTalking(!success); // If stop succeeded, we're no longer talking
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <StatusBar backgroundColor="rgba(0,0,0,0.95)" barStyle="light-content" />
      <Animated.View style={[styles.modalOverlay, { opacity: fadeAnim }]}>
        <Animated.View
          style={[
            styles.modalContent,
            {
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.headerTitle}>Live Monitor</Text>
              {isLive && (
                <View style={styles.liveIndicator}>
                  <PulseView color={COLORS.error}>
                    <View style={styles.liveDot} />
                  </PulseView>
                  <Text style={styles.liveText}>LIVE</Text>
                </View>
              )}
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
              <Ionicons name="close" size={28} color={COLORS.white} />
            </TouchableOpacity>
          </View>

          {/* Video Container */}
          <View style={styles.videoContainer} ref={viewRef} collapsable={false}>
            <CameraStream width={width} height={width * 0.75} />

            {/* Recording Indicator */}
            {isRecording && (
              <View style={styles.recordingIndicator}>
                <PulseView color={COLORS.error}>
                  <View style={styles.recordingDot} />
                </PulseView>
                <Text style={styles.recordingText}>REC</Text>
              </View>
            )}

            {/* Position Overlay */}
            <View style={styles.positionOverlay}>
              <View style={styles.positionBadge}>
                <Ionicons
                  name="checkmark-circle"
                  size={16}
                  color={COLORS.success}
                />
                <Text style={styles.positionText}>Safe - {position}</Text>
              </View>
            </View>
          </View>

          {/* Controls */}
          <View style={styles.controls}>
            <TouchableOpacity
              style={styles.controlButton}
              onPress={handleSnapshot}
            >
              <View style={styles.controlIconContainer}>
                <Ionicons
                  name="camera-outline"
                  size={24}
                  color={COLORS.white}
                />
              </View>
              <Text style={styles.controlLabel}>Snapshot</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.controlButton}
              onPress={handleToggleRecording}
            >
              <View
                style={[
                  styles.controlIconContainer,
                  styles.recordButton,
                  isRecording && styles.recordingActive,
                ]}
              >
                <Ionicons
                  name={isRecording ? "stop" : "radio-button-on"}
                  size={28}
                  color={COLORS.error}
                />
              </View>
              <Text style={styles.controlLabel}>
                {isRecording ? "Stop" : "Record"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.controlButton}
              onPress={handleToggleTalkBack}
              onLongPress={handleStartTalkBack}
              onPressOut={isTalking ? handleStopTalkBack : undefined}
            >
              <View
                style={[
                  styles.controlIconContainer,
                  isTalking && styles.talkingActive,
                ]}
              >
                <Ionicons
                  name={isTalking ? "mic" : "mic-outline"}
                  size={24}
                  color={COLORS.white}
                />
              </View>
              <Text style={styles.controlLabel}>
                {isTalking ? "Talking..." : "Talk"}
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.95)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: width,
    height: height,
    justifyContent: "space-between",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: LAYOUT.spacing.lg,
    paddingTop: 60,
    paddingBottom: LAYOUT.spacing.md,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.white,
    marginRight: LAYOUT.spacing.md,
  },
  liveIndicator: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(244, 67, 54, 0.2)",
    paddingHorizontal: LAYOUT.spacing.sm,
    paddingVertical: 6,
    borderRadius: LAYOUT.borderRadius.sm,
    borderWidth: 1,
    borderColor: COLORS.error,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.error,
    marginRight: 6,
  },
  liveText: {
    fontSize: 12,
    color: COLORS.error,
    fontWeight: "700",
    letterSpacing: 1,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  videoContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: LAYOUT.spacing.md,
    borderRadius: LAYOUT.borderRadius.lg,
    overflow: "hidden",
    backgroundColor: COLORS.black,
  },
  video: {
    width: "100%",
    height: "100%",
  },
  recordingIndicator: {
    position: "absolute",
    top: LAYOUT.spacing.md,
    right: LAYOUT.spacing.md,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(244, 67, 54, 0.9)",
    paddingHorizontal: LAYOUT.spacing.md,
    paddingVertical: LAYOUT.spacing.sm,
    borderRadius: LAYOUT.borderRadius.sm,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.white,
    marginRight: 6,
  },
  recordingText: {
    fontSize: 12,
    color: COLORS.white,
    fontWeight: "700",
    letterSpacing: 1,
  },
  positionOverlay: {
    position: "absolute",
    top: LAYOUT.spacing.md,
    left: LAYOUT.spacing.md,
  },
  positionBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    paddingHorizontal: LAYOUT.spacing.md,
    paddingVertical: LAYOUT.spacing.sm,
    borderRadius: LAYOUT.borderRadius.sm,
  },
  positionText: {
    fontSize: 13,
    color: COLORS.white,
    fontWeight: "600",
    marginLeft: 6,
  },
  controls: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingHorizontal: LAYOUT.spacing.xl,
    paddingBottom: 50,
    paddingTop: LAYOUT.spacing.lg,
  },
  controlButton: {
    alignItems: "center",
  },
  controlIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: LAYOUT.spacing.sm,
  },
  recordButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "rgba(244, 67, 54, 0.2)",
    borderWidth: 2,
    borderColor: COLORS.error,
  },
  recordingActive: {
    backgroundColor: COLORS.error,
  },
  talkingActive: {
    backgroundColor: COLORS.primary,
  },
  controlLabel: {
    fontSize: 12,
    color: COLORS.white,
    fontWeight: "600",
  },
});

export default FullScreenVideoModal;
