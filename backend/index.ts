/**
 * WALDI Backend — Entry Point
 *
 * REST API that queries Timescale Cloud.
 * Live data goes: Pi → EMQX → App (directly via MQTT).
 * This backend handles: historical queries + device pairing.
 */

import { startServer } from "./server";
import { startCryPushNotifications } from "./cryPushNotifications";

startServer().catch((err) => {
  console.error("[startup] Failed to start backend:", err);
  process.exit(1);
});

startCryPushNotifications().catch((err) => {
  console.error("[startup] Failed to start cry push notifier:", err);
});
