import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@clerk/clerk-expo";
import { COLORS, LAYOUT } from "../constants";
import { DEVICES_CLAIM_URL, DEVICES_URL } from "../services/backend/config";

interface PairingScreenProps {
  onPaired: () => void;
}

const PairingScreen: React.FC<PairingScreenProps> = ({ onPaired }) => {
  const { getToken } = useAuth();
  const [piIp, setPiIp] = useState("172.20.10.2");
  const [loading, setLoading] = useState(false);
  const [checkingDevices, setCheckingDevices] = useState(true);

  // On mount, check if user already has a paired device
  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        const res = await fetch(DEVICES_URL, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const devices = await res.json();
          if (devices.length > 0) {
            // Already paired — skip to dashboard
            onPaired();
            return;
          }
        }
      } catch {
        // Network error — stay on pairing screen
      }
      setCheckingDevices(false);
    })();
  }, []);

  const onPairPress = async () => {
    if (!piIp.trim()) {
      Alert.alert("Error", "Please enter your Pi's IP address");
      return;
    }

    setLoading(true);

    try {
      // Step 1: Fetch device_id from the Pi
      const piUrl = `http://${piIp.trim()}:8000/device-id`;
      let deviceId: string;

      try {
        const piRes = await fetch(piUrl, { method: "GET" });
        if (!piRes.ok) throw new Error(`Pi responded with ${piRes.status}`);
        const piData = await piRes.json();
        deviceId = piData.device_id;
        if (!deviceId) throw new Error("No device_id in response");
      } catch (err: any) {
        Alert.alert(
          "Can't Reach Pi",
          `Make sure your Pi is running and accessible at ${piIp}:8000.\n\n${err.message}`,
        );
        return;
      }

      // Step 2: Claim the device on our backend
      const token = await getToken();
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
      });

      if (!claimRes.ok) {
        const errData = await claimRes.json().catch(() => ({}));
        throw new Error(errData.error || `Server returned ${claimRes.status}`);
      }

      Alert.alert("Success!", `Device ${deviceId} paired successfully.`, [
        { text: "Continue", onPress: onPaired },
      ]);
    } catch (err: any) {
      Alert.alert("Pairing Failed", err.message);
    } finally {
      setLoading(false);
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Icon */}
          <View style={styles.iconContainer}>
            <View style={styles.iconCircle}>
              <Ionicons name="wifi" size={48} color={COLORS.white} />
            </View>
            <Text style={styles.title}>Pair Your Device</Text>
            <Text style={styles.subtitle}>
              Connect your WALADI baby monitor to start receiving sensor data.
            </Text>
          </View>

          {/* Form */}
          <View style={styles.formContainer}>
            <Text style={styles.label}>Raspberry Pi IP Address</Text>
            <View style={styles.inputContainer}>
              <Ionicons
                name="globe-outline"
                size={20}
                color={COLORS.gray}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="e.g. 172.20.10.2"
                placeholderTextColor={COLORS.textDisabled}
                value={piIp}
                onChangeText={setPiIp}
                keyboardType="numeric"
                autoCorrect={false}
              />
            </View>

            <Text style={styles.hint}>
              Make sure your phone and the Pi are on the same Wi-Fi network.
            </Text>

            {/* Pair Button */}
            <TouchableOpacity
              style={[
                styles.pairButton,
                (!piIp.trim() || loading) && styles.buttonDisabled,
              ]}
              onPress={onPairPress}
              disabled={!piIp.trim() || loading}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <>
                  <Ionicons
                    name="link"
                    size={20}
                    color={COLORS.white}
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.pairButtonText}>Pair Device</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Steps */}
          <View style={styles.stepsContainer}>
            <Text style={styles.stepsTitle}>How it works</Text>
            <Step number={1} text="Power on your WALADI device" />
            <Step number={2} text="Connect it to the same Wi-Fi network" />
            <Step number={3} text="Enter the Pi's IP address above" />
            <Step number={4} text='Tap "Pair Device" to connect' />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: LAYOUT.spacing.lg,
    justifyContent: "center",
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
  iconContainer: {
    alignItems: "center",
    marginBottom: 32,
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
  },
  formContainer: {
    backgroundColor: COLORS.white,
    borderRadius: LAYOUT.borderRadius.lg,
    padding: LAYOUT.spacing.lg,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    marginBottom: LAYOUT.spacing.lg,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textPrimary,
    marginBottom: LAYOUT.spacing.sm,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.lightGray,
    borderRadius: LAYOUT.borderRadius.sm,
    paddingHorizontal: LAYOUT.spacing.md,
    height: 52,
    marginBottom: LAYOUT.spacing.sm,
  },
  inputIcon: {
    marginRight: LAYOUT.spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  hint: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: LAYOUT.spacing.md,
  },
  pairButton: {
    backgroundColor: COLORS.primary,
    borderRadius: LAYOUT.borderRadius.sm,
    height: 52,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  pairButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "700",
  },
  stepsContainer: {
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
});

export default PairingScreen;
