import { useEffect } from "react";
import { connectToAiPoseStream } from "../services/backend/aiPoseClient";

export function useAiPoseLogging(): void {
  useEffect(() => {
    const disconnect = connectToAiPoseStream(
      (payload) => {
        console.log("[AI Pose]", JSON.stringify(payload));
      },
      (err) => {
        console.error("[ai-pose] Stream error:", err.message);
      },
    );

    return () => {
      disconnect();
    };
  }, []);
}
