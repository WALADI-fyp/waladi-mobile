/**
 * WALDI Frontend Configuration
 *
 * - Live data: EMQX Cloud MQTT broker (WSS)
 * - Historical data + auth: local Node.js REST API
 */

// ── EMQX Cloud (live sensor data via MQTT over WSS) ──
export const EMQX_HOST = "ra216119.ala.eu-central-1.emqxsl.com";
export const EMQX_PORT = 8084;
export const EMQX_URL = `wss://${EMQX_HOST}:${EMQX_PORT}/mqtt`;
export const EMQX_USERNAME = "waladi_app";
export const EMQX_PASSWORD = "123456";
export const MQTT_TOPIC = "state/baby";
export const CAMERA_TOPIC = "camera/snapshot";
export const AI_POSE_TOPIC = "waladi/ai/pose";
export const CRY_ALERT_TOPIC = "waladi/alerts/cry";

// ── Node.js REST API (deployed on Render) ──
export const BACKEND_URL = "https://waladi-mobile.onrender.com";
export const READINGS_URL = `${BACKEND_URL}/api/readings`;
export const DEVICES_CLAIM_URL = `${BACKEND_URL}/api/devices/claim`;
export const DEVICES_URL = `${BACKEND_URL}/api/devices`;
export const SENSOR_DATA_URL = `${BACKEND_URL}/api/sensor-data`;
export const ANALYTICS_URL = `${BACKEND_URL}/api/analytics`;
export const CRY_ALERTS_URL = `${BACKEND_URL}/api/alerts/cry`;
export const EXPO_PUSH_TOKEN_URL = `${BACKEND_URL}/api/notifications/expo-token`;
