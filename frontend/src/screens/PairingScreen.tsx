import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@clerk/clerk-expo";
import { COLORS, LAYOUT } from "../constants";
import { DEVICES_CLAIM_URL, DEVICES_URL } from "../services/backend/config";

interface PairingScreenProps {
  onPaired: () => void;
}

const PairingScreen: React.FC<PairingScreenProps> = ({ onPaired }) => {
  const { getToken } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingDevices, setCheckingDevices] = useState(true);
  const scanProcessed = useRef(false);

  // On mount, check if user already has a paired device
  useEffect(() => {
    (async () => {
      console.log("[PairingScreen] Checking for existing devices...");
      console.log("[PairingScreen] DEVICES_URL =", DEVICES_URL);
      const controller = new AbortController();
      const timeout = setTimeout(() => {
        console.log("[PairingScreen] Fetch timed out after 60s");
        controller.abort();
      }, 60000);
      try {
        const token = await getToken();
        console.log("[PairingScreen] Got auth token:", token ? "yes" : "NO TOKEN");
        const res = await fetch(DEVICES_URL, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        clearTimeout(timeout);
        console.log("[PairingScreen] Response status:", res.status);
        if (res.ok) {
          const devices = await res.json();
          console.log("[PairingScreen] Devices found:", devices.length, devices);
          if (devices.length > 0) {
            console.log("[PairingScreen] ✅ Already paired — skipping to dashboard");
            onPaired();
            return;
          }
        } else {
          const text = await res.text().catch(() => "");
          console.log("[PairingScreen] Non-OK response body:", text);
        }
      } catch (err: any) {
        clearTimeout(timeout);
        console.log("[PairingScreen] Device check error:", err.message || err);
      }
      console.log("[PairingScreen] No paired device, showing pairing screen.");
      setCheckingDevices(false);
    })();
  }, []);

  const claimDevice = async (deviceId: string) => {
    setLoading(true);
    console.log("[PairingScreen] Claiming device:", deviceId, "URL:", DEVICES_CLAIM_URL);
    try {
      const token = await getToken();
      console.log("[PairingScreen] Auth token for claim:", token ? "yes" : "NO TOKEN");

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000);

      const claimRes = await fetch(DEVICES_CLAIM_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          device_id: deviceId,
          name: "My Baby Monitor",
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      console.log("[PairingScreen] Claim response status:", claimRes.status);
      const resBody = await claimRes.text();
      console.log("[PairingScreen] Claim response body:", resBody);

      if (!claimRes.ok) {
        const errData = JSON.parse(resBody).error || `Server returned ${claimRes.status}`;
        throw new Error(errData);
      }

      Alert.alert("Success!", `Device paired successfully.`, [
        { text: "Continue", onPress: onPaired },
      ]);
    } catch (err: any) {
      console.log("[PairingScreen] Claim error:", err.message || err);
      Alert.alert("Pairing Failed", err.message);
      setScanning(false);
    } finally {
      setLoading(false);
    }
  };

  const handleBarcodeScan = ({ data }: { data: string }) => {
    // Prevent duplicate scans — ref is synchronous, unlike state
    if (scanProcessed.current) return;
    scanProcessed.current = true;

    console.log("[PairingScreen] ✅ Barcode scanned! Raw data:", data);
    if (loading) {
      console.log("[PairingScreen] Ignoring scan — already loading");
      scanProcessed.current = false;
      return;
    }

    try {
      const parsed = JSON.parse(data);
      console.log("[PairingScreen] Parsed QR JSON:", parsed);
      if (!parsed.device_id || typeof parsed.device_id !== "string") {
        console.log("[PairingScreen] No valid device_id in QR data");
        Alert.alert("Invalid QR Code", "QR code doesn't contain a valid device_id.", [
          { text: "Try Again", onPress: () => { scanProcessed.current = false; setScanning(true); } },
        ]);
        setScanning(false);
        return;
      }

      console.log("[PairingScreen] Claiming device_id:", parsed.device_id);
      setScanning(false);
      claimDevice(parsed.device_id);
    } catch (err: any) {
      console.log("[PairingScreen] QR parse error:", err.message, "raw:", data);
      Alert.alert("Invalid QR Code", "Could not read the QR code. Make sure you're scanning a WALADI device QR.", [
        { text: "Try Again", onPress: () => { scanProcessed.current = false; setScanning(true); } },
      ]);
      setScanning(false);
    }
  };

  if (checkingDevices) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Checking devices...</Text>
      </View>
    );
  }

  // Camera permission not yet granted
  if (!permission?.granted) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centeredContent}>
          <View style={styles.iconCircle}>
            <Ionicons name="camera-outline" size={48} color={COLORS.white} />
          </View>
          <Text style={styles.title}>Camera Access Needed</Text>
          <Text style={styles.subtitle}>
            We need camera access to scan the QR code on your WALADI device.
          </Text>
          <TouchableOpacity style={styles.primaryButton} onPress={requestPermission}>
            <Text style={styles.primaryButtonText}>Allow Camera</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // QR scanner active
  if (scanning) {
    return (
      <View style={styles.scannerContainer}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={loading ? undefined : handleBarcodeScan}
        />

        {/* Overlay */}
        <SafeAreaView style={styles.scannerOverlay}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setScanning(false)}
          >
            <Ionicons name="close" size={28} color={COLORS.white} />
          </TouchableOpacity>

          <View style={styles.scannerMiddle}>
            <View style={styles.scanFrame} />
            <Text style={styles.scanHint}>
              Point at the QR code on your WALADI device
            </Text>
          </View>

          {loading && (
            <View style={styles.scannerLoading}>
              <ActivityIndicator size="large" color={COLORS.white} />
              <Text style={styles.scannerLoadingText}>Pairing device...</Text>
            </View>
          )}
        </SafeAreaView>
      </View>
    );
  }

  // Default: instructions + scan button
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.centeredContent}>
        {/* Icon */}
        <View style={styles.iconCircle}>
          <Ionicons name="qr-code-outline" size={48} color={COLORS.white} />
        </View>
        <Text style={styles.title}>Pair Your Device</Text>
        <Text style={styles.subtitle}>
          Scan the QR code on your WALADI baby monitor to connect.
        </Text>

        {/* Scan Button */}
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => { scanProcessed.current = false; setScanning(true); }}
        >
          <Ionicons
            name="scan"
            size={22}
            color={COLORS.white}
            style={{ marginRight: 8 }}
          />
          <Text style={styles.primaryButtonText}>Scan QR Code</Text>
        </TouchableOpacity>

        {/* Steps */}
        <View style={styles.stepsContainer}>
          <Text style={styles.stepsTitle}>How it works</Text>
          <Step number={1} text="Power on your WALADI device" />
          <Step number={2} text="Find the QR code on the device" />
          <Step number={3} text='Tap "Scan QR Code" above' />
          <Step number={4} text="Point your camera at the QR code" />
        </View>
      </View>
    </SafeAreaView>
  );
};

const Step: React.FC<{ number: number; text: string }> = ({
  number,
  text,
}) => (
  <View style={styles.stepRow}>
    <View style={styles.stepCircle}>
      <Text style={styles.stepNumber}>{number}</Text>
    </View>
    <Text style={styles.stepText}>{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centeredContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: LAYOUT.spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.background,
  },
  loadingText: {
    marginTop: LAYOUT.spacing.md,
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: LAYOUT.spacing.md,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: LAYOUT.spacing.lg,
    marginBottom: 24,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: LAYOUT.borderRadius.sm,
    height: 52,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 32,
  },
  primaryButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "700",
  },
  stepsContainer: {
    alignSelf: "stretch",
    paddingHorizontal: LAYOUT.spacing.sm,
  },
  stepsTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.textPrimary,
    marginBottom: LAYOUT.spacing.md,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: LAYOUT.spacing.md,
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primaryLight,
    justifyContent: "center",
    alignItems: "center",
    marginRight: LAYOUT.spacing.sm,
  },
  stepNumber: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "700",
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textSecondary,
  },

  // Scanner styles
  scannerContainer: {
    flex: 1,
    backgroundColor: "#000",
  },
  scannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
  },
  closeButton: {
    alignSelf: "flex-end",
    margin: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  scannerMiddle: {
    alignItems: "center",
  },
  scanFrame: {
    width: 240,
    height: 240,
    borderWidth: 2,
    borderColor: COLORS.white,
    borderRadius: 16,
    marginBottom: 16,
  },
  scanHint: {
    color: COLORS.white,
    fontSize: 14,
    textAlign: "center",
    paddingHorizontal: 32,
  },
  scannerLoading: {
    alignItems: "center",
    marginBottom: 48,
  },
  scannerLoadingText: {
    color: COLORS.white,
    marginTop: 8,
    fontSize: 14,
  },
});

export default PairingScreen;
