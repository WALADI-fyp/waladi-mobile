/**
 * WALDI Frontend Configuration
 *
 * Points to the backend server which proxies data from the Pi
 * and serves it from the database.
 */

// Backend server IP — this is your dev machine's local IP.
// If you run the backend on the same machine as Expo, you can find it
// by running `ipconfig` in a terminal and looking for the IPv4 address
// on the same network as the Pi (172.20.10.x).
export const BACKEND_IP = "172.20.10.5";

export const BASE_URL = `http://${BACKEND_IP}:3000`;
export const STREAM_URL = `${BASE_URL}/api/stream`;
export const LATEST_URL = `${BASE_URL}/api/readings/latest`;
export const READINGS_URL = `${BASE_URL}/api/readings`;
