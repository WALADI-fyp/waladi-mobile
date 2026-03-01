import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  ActivityIndicator,
} from "react-native";
import { COLORS, LAYOUT } from "../../constants";
import PulseView from "../common/PulseView";

// ── Pi camera service endpoints ──
// Uses the same Pi IP as the backend config (172.20.10.2).
// The camera service runs on port 8001.
const PI_IP = "172.20.10.2";
const SNAPSHOT_URL = `http://${PI_IP}:8001/snapshot`;
const STATUS_URL = `http://${PI_IP}:8001/status`;
const FPS = 20;

interface CameraStreamProps {
  width?: number;
  height?: number;
}

const CameraStream: React.FC<CameraStreamProps> = ({
  width = 320,
  height = 180,
}) => {
  const [uri, setUri] = useState<string | null>(null);
  const [available, setAvailable] = useState<boolean | null>(null);
  const frameCount = useRef(0);

  // ── Check if the Pi camera is reachable ──
  useEffect(() => {
    fetch(STATUS_URL)
      .then((r) => r.json())
      .then((d) => setAvailable(d.camera_available))
      .catch(() => setAvailable(false));
  }, []);

  // ── Poll snapshot frames when available ──
  useEffect(() => {
    if (!available) return;

    const poll = () => {
      frameCount.current += 1;
      setUri(`${SNAPSHOT_URL}?f=${frameCount.current}`);
    };

    poll();
    const id = setInterval(poll, 1000 / FPS);
    return () => clearInterval(id);
  }, [available]);

  // ── Loading state ──
  if (available === null) {
    return (
      <View style={[styles.container, { width, height }]}>
        <ActivityIndicator color={COLORS.primary} />
        <Text style={styles.loadingText}>Connecting to camera…</Text>
      </View>
    );
  }

  // ── Unavailable state ──
  if (!available) {
    return (
      <View style={[styles.container, { width, height }]}>
        <Text style={styles.unavailableText}>Camera unavailable</Text>
      </View>
    );
  }

  // ── Live stream ──
  return (
    <View style={[styles.container, { width, height }]}>
      {uri && (
        <Image
          source={{ uri, cache: "reload" }}
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
