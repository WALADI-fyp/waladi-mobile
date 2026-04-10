import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  ActivityIndicator,
} from "react-native";
import { COLORS, LAYOUT } from "../../constants";
import PulseView from "../common/PulseView";
import { connectToCameraStream } from "../../services/backend/cameraClient";

interface CameraStreamProps {
  width?: number;
  height?: number;
}

const CameraStream: React.FC<CameraStreamProps> = ({
  width = 320,
  height = 180,
}) => {
  const [uri, setUri] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const disconnect = connectToCameraStream(
      (base64Uri) => {
        setUri(base64Uri);
        if (!connected) setConnected(true);
        setError(null);
      },
      (err) => {
        console.warn("[CameraStream] error:", err.message);
        setError(err.message);
      },
    );

    // Mark as connected after a short delay so "connecting" shows briefly
    const timeout = setTimeout(() => {
      // If still no frame after 5s, likely no camera publishing
    }, 5000);

    return () => {
      clearTimeout(timeout);
      disconnect();
    };
  }, []);

  // ── Loading state (no frame yet, no error) ──
  if (!uri && !error) {
    return (
      <View style={[styles.container, { width, height }]}>
        <ActivityIndicator color={COLORS.primary} />
        <Text style={styles.loadingText}>Connecting to camera…</Text>
      </View>
    );
  }

  // ── Error state ──
  if (error && !uri) {
    return (
      <View style={[styles.container, { width, height }]}>
        <Text style={styles.unavailableText}>Camera unavailable</Text>
        <Text style={styles.errorDetail}>{error}</Text>
      </View>
    );
  }

  // ── Live stream (base64 JPEG frames) ──
  return (
    <View style={[styles.container, { width, height }]}>
      {uri && (
        <Image
          source={{ uri }}
          style={{ width, height }}
          resizeMode="contain"
        />
      )}

      <View style={styles.liveBadge}>
        <PulseView color={COLORS.error}>
          <View style={styles.liveDot} />
        </PulseView>
        <Text style={styles.liveText}>LIVE</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.black,
    borderRadius: LAYOUT.borderRadius.md,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    color: COLORS.white,
    fontSize: 12,
    marginTop: LAYOUT.spacing.sm,
  },
  unavailableText: {
    color: COLORS.white,
    fontSize: 13,
  },
  errorDetail: {
    color: COLORS.gray,
    fontSize: 10,
    marginTop: 4,
  },
  liveBadge: {
    position: "absolute",
    top: LAYOUT.spacing.sm,
    left: LAYOUT.spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 6,
    paddingVertical: 3,
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
    color: COLORS.white,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    marginLeft: 4,
  },
});

export default CameraStream;
