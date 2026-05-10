import { useState, useEffect, useRef, useCallback } from "react";
import { connectToStream } from "../services/sensor.service";
import { SensorPayload } from "../services/sensor.service";
import { VitalSign } from "../types/monitor.types";

/** How long (ms) without a message before we consider the stream stale. */
const STALE_THRESHOLD_MS = 3000;

/** Simple threshold logic to derive a status from a value. */
function deriveStatus(
  field: string,
  value: number,
): "normal" | "warning" | "critical" {
  switch (field) {
    case "heart_rate_bpm":
      if (value < 100 || value > 160) return "critical";
      if (value < 110 || value > 150) return "warning";
      return "normal";

    case "breathing_rate_bpm":
      if (value < 25 || value > 60) return "critical";
      if (value < 30 || value > 50) return "warning";
      return "normal";

    case "body_temperature_c":
      if (value < 36.0 || value > 38.0) return "critical";
      if (value < 36.3 || value > 37.5) return "warning";
      return "normal";

    case "room_temperature_c":
      if (value < 16 || value > 28) return "critical";
      if (value < 18 || value > 26) return "warning";
      return "normal";

    case "room_humidity_rh":
      if (value < 20 || value > 70) return "critical";
      if (value < 30 || value > 60) return "warning";
      return "normal";

    default:
      return "normal";
  }
}

/** Maps a sensor field to a UI-friendly vital-sign card descriptor. */
const FIELD_CONFIG: Record<
  string,
  { id: string; label: string; unit: string; icon: string }
> = {
  heart_rate_bpm: {
    id: "heart_rate",
    label: "Heart Rate",
    unit: "bpm",
    icon: "heart-outline",
  },
  breathing_rate_bpm: {
    id: "breathing_rate",
    label: "Breathing Rate",
    unit: "bpm",
    icon: "fitness-outline",
  },
  body_temperature_c: {
    id: "body_temp",
    label: "Body Temp",
    unit: "°C",
    icon: "thermometer-outline",
  },
  room_temperature_c: {
    id: "room_temp",
    label: "Room Temp",
    unit: "°C",
    icon: "home-outline",
  },
  room_humidity_rh: {
    id: "humidity",
    label: "Humidity",
    unit: "%",
    icon: "water-outline",
  },
};

const FIELD_KEYS = Object.keys(FIELD_CONFIG);

/** Convert a SensorPayload into an array of VitalSign objects. */
function payloadToVitalSigns(payload: SensorPayload): VitalSign[] {
  const { data } = payload;
  const mockSet = new Set(data.mock_fields ?? []);

  return FIELD_KEYS.map((key) => {
    const config = FIELD_CONFIG[key];
    const rawValue = (data as any)[key] as number;
    const isMock = mockSet.has(key);
    const status = deriveStatus(key, rawValue);

    // Format the display value
    let displayValue: string;
    if (key.includes("temperature")) {
      displayValue = `${rawValue.toFixed(1)}`;
    } else {
      displayValue = `${Math.round(rawValue)}`;
    }

    return {
      id: config.id,
      label: config.label,
      value: displayValue,
      unit: config.unit,
      status,
      icon: config.icon,
      isMock,
    };
  });
}

export interface UseVitalSignsResult {
  vitalSigns: VitalSign[];
  isConnected: boolean;
  isStale: boolean;
  error: string | null;
}

/**
 * Hook that connects to the Pi SSE stream and returns live vital-sign data.
 *
 * - `vitalSigns` — array of 5 VitalSign objects, updated every ~1 s
 * - `isConnected` — true once the first message arrives
 * - `isStale` — true if no message received in >3 s
 * - `error` — last error message, or null
 */
export function useVitalSigns(): UseVitalSignsResult {
  const [vitalSigns, setVitalSigns] = useState<VitalSign[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lastTsRef = useRef<number>(0);
  const staleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleData = useCallback((payload: SensorPayload) => {
    lastTsRef.current = Date.now();
    setIsConnected(true);
    setIsStale(false);
    setError(null);
    setVitalSigns(payloadToVitalSigns(payload));
  }, []);

  const handleError = useCallback((err: Error) => {
    setError(err.message);
  }, []);

  useEffect(() => {
    const disconnect = connectToStream(handleData, handleError);

    // Stale-detection timer: check every second
    staleTimerRef.current = setInterval(() => {
      if (lastTsRef.current > 0) {
        const age = Date.now() - lastTsRef.current;
        setIsStale(age > STALE_THRESHOLD_MS);
      }
    }, 1000);

    return () => {
      disconnect();
      if (staleTimerRef.current) {
        clearInterval(staleTimerRef.current);
      }
    };
  }, [handleData, handleError]);

  return { vitalSigns, isConnected, isStale, error };
}
