/**
 * WALDI Backend — Entry Point
 *
 * REST API that queries Timescale Cloud.
 * Live data goes: Pi → EMQX → App (directly via MQTT).
 * This backend handles: historical queries + device pairing.
 */

import { startServer } from "./server";
import { startCryPushNotifications } from "./cryPushNotifications";

async function bootstrap(): Promise<void> {
  await startServer();
  await startCryPushNotifications();
}

bootstrap().catch((err) => {
  console.error("[startup] Failed to start backend services:", err);
  process.exit(1);
});
