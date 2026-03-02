/**
 * WALDI Backend — Entry Point
 *
 * REST API that queries Timescale Cloud.
 * Live data goes: Pi → EMQX → App (directly via MQTT).
 * This backend handles: historical queries + device pairing.
 */

import { startServer } from "./server";

startServer();
