# WALADI Backend & Data Flow — Architecture Summary

## Overview

The system has two data paths:

- **Live data:** Pi → EMQX Cloud (MQTT) → App directly via WebSocket
- **Historical data + auth:** Pi → EMQX → TimescaleDB (via Pi's `db_writer_service`) → Node.js REST API → App

The Node.js backend is a **REST-only** Express/TypeScript server. It no longer has an SSE ingester — it just queries TimescaleDB for historical data and handles device pairing via Clerk auth.

### Boot Sequence (`index.ts`)

1. **Initialize Database** — creates tables & hypertables if they don't exist
2. **Start Express REST API** — serves historical data + device endpoints

---

## Core Modules

### `config.ts` — Configuration

Loads from `.env`:

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | Express server port |
| `DB_HOST` | `localhost` | PostgreSQL/TimescaleDB host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_USER` | `postgres` | Database user |
| `DB_PASSWORD` | (empty) | Database password |
| `DB_NAME` | `sensors_db` | Database name |

### `db.ts` — Database Layer

- Uses `pg.Pool` for connection pooling
- `initDb()` creates:
  - **`sensor_readings`** table (TimescaleDB hypertable) — stores all sensor data
  - **`user_devices`** table — maps Clerk users to Pi devices
  - Indexes on `user_id` and `(user_id, time DESC)`
- Safely re-runnable: uses `IF NOT EXISTS` and conditional `ALTER TABLE`

#### `sensor_readings` Schema

| Column | Type | Description |
|---|---|---|
| `time` | `TIMESTAMPTZ` | Timestamp of the reading (hypertable partition key) |
| `source` | `TEXT` | Origin identifier (e.g. `"fusion_service"`) |
| `heart_rate_bpm` | `DOUBLE PRECISION` | Baby's heart rate |
| `breathing_rate_bpm` | `DOUBLE PRECISION` | Baby's breathing rate |
| `room_temperature_c` | `DOUBLE PRECISION` | Room temperature in °C |
| `body_temperature_c` | `DOUBLE PRECISION` | Body temperature in °C |
| `room_humidity_rh` | `DOUBLE PRECISION` | Room humidity (%) |
| `mock_fields` | `TEXT[]` | Flags which fields are mocked/simulated |
| `device_id` | `TEXT` | Pi device ID |
| `user_id` | `TEXT` | Clerk user ID (resolved from device_id) |

#### `user_devices` Schema

| Column | Type | Description |
|---|---|---|
| `id` | `SERIAL` | Auto-increment PK |
| `user_id` | `TEXT` | Clerk user ID |
| `device_id` | `TEXT` | Pi device ID (unique) |
| `name` | `TEXT` | Friendly device name (default: `"My Device"`) |
| `created_at` | `TIMESTAMPTZ` | When the device was claimed |

### `types.ts` — Shared Types

- **`SensorData`** — the `data` sub-object (heart rate, breathing rate, temperatures, humidity, mock_fields)
- **`SensorPayload`** — full Pi payload (`ts`, `source`, `device_id?`, `data`)
- **`SensorReading`** — database row shape

---

## API Endpoints (`server.ts`)

All endpoints are prefixed with `/api`. The server uses `cors()` globally and Clerk middleware on all routes (non-blocking by default).

**Removed endpoints:** `/api/readings/latest` (was in-memory, now the app gets live data from EMQX), `/api/stream` (SSE, replaced by MQTT), `POST /api/sensor-data` (Pi writes to DB directly via `db_writer_service`).

---

### 1. `GET /api/readings`

**Auth:** Optional (if authenticated, results are scoped to the user's data)

**Query Parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| `limit` | `number` | `100` | Max rows returned (capped at 1000) |
| `from` | `ISO string` | — | Start time filter |
| `to` | `ISO string` | — | End time filter |

**Description:** Fetches historical sensor readings from the database. If the request includes a valid Clerk auth token, results are filtered to only that user's data (`WHERE user_id = ?`).

**Response:**
- `200` — JSON array of sensor reading rows
- `500` — Internal server error

**Frontend usage:** Called from `READINGS_URL` constant.

---

### 2. `POST /api/devices/claim`

**Auth:** **Required** (Clerk `requireAuth()`)

**Description:** Links a Raspberry Pi device to the authenticated Clerk user. Uses an upsert — if the device is already claimed, it transfers ownership to the new user.

**Request Body:**

| Field | Type | Required | Description |
|---|---|---|---|
| `device_id` | `string` | Yes | Pi device identifier |
| `name` | `string` | No | Friendly name (default: `"My Device"`) |

**Response:**
- `200` — `{ success: true, device: { ...row } }`
- `400` — `device_id` missing
- `401` — Unauthorized (no valid Clerk session)
- `500` — Database error

**Frontend usage:** Called from `DEVICES_CLAIM_URL` during the pairing flow.

---

### 3. `GET /api/devices`

**Auth:** **Required** (Clerk `requireAuth()`)

**Description:** Returns all devices claimed by the authenticated user, ordered newest first.

**Response:**
- `200` — JSON array of `user_devices` rows
- `401` — Unauthorized
- `500` — Database error

**Frontend usage:** Called from `DEVICES_URL` constant.

---

### 4. `GET /api/sensor-data`

**Auth:** **Required** (Clerk `requireAuth()`)

**Description:** Fetches sensor data for the authenticated user only (`WHERE user_id = ?`).

**Query Parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| `limit` | `number` | `100` | Max rows returned (capped at 1000) |

**Response:**
- `200` — JSON array of sensor readings (excludes `user_id` from response)
- `401` — Unauthorized
- `500` — Database error

**Frontend usage:** Called from `SENSOR_DATA_URL` constant.

---

## Data Flow Diagram

```
┌──────────────┐   MQTT (state/baby)    ┌──────────────────┐
│ Raspberry Pi │ ─────────────────────► │   EMQX Cloud     │
│ fusion_service│                       │  (MQTT Broker)   │
└──────┬───────┘                        └────────┬─────────┘
       │                                         │
       │  db_writer_service                      │  WSS :8084/mqtt
       │  (writes to TimescaleDB)                │
       ▼                                         ▼
┌──────────────┐                        ┌───────────────────┐
│ TimescaleDB  │                        │  React Native App │
│ (PostgreSQL) │                        │  (mqttClient.ts)  │
└──────┬───────┘                        │  Live UI updates  │
       │                                └────────┬──────────┘
       │                                         │
       ▼                                         │ REST (historical
┌──────────────────┐                             │  data + pairing)
│ Node.js Backend  │◄────────────────────────────┘
│ (REST-only API)  │
│ /api/readings    │
│ /api/devices     │
│ /api/sensor-data │
└──────────────────┘
```

## Frontend Integration

| Frontend File | Data Source | Method |
|---|---|---|
| `mqttClient.ts` → `connectToStream()` | EMQX Cloud `state/baby` | MQTT over WSS |
| `sensor.service.ts` | Re-exports from mqttClient | — |
| Config constants (`config.ts`) | REST endpoints on deployed backend | HTTP |

### Frontend Config (`frontend/src/services/backend/config.ts`)

```
# EMQX Cloud (live data)
EMQX_HOST      = "ra216119.ala.eu-central-1.emqxsl.com"
EMQX_PORT      = 8084
EMQX_URL       = wss://{EMQX_HOST}:8084/mqtt
EMQX_USERNAME  = "waladi_app"
MQTT_TOPIC     = "state/baby"

# Node.js REST API (historical data + auth)
BACKEND_URL       = https://your-waladi-backend.up.railway.app
READINGS_URL      = {BACKEND_URL}/api/readings
DEVICES_CLAIM_URL = {BACKEND_URL}/api/devices/claim
DEVICES_URL       = {BACKEND_URL}/api/devices
SENSOR_DATA_URL   = {BACKEND_URL}/api/sensor-data
```

## Dependencies

### Backend (Node.js)

| Package | Purpose |
|---|---|
| `express` | HTTP server framework |
| `cors` | Cross-origin support |
| `@clerk/express` | Authentication middleware |
| `pg` | PostgreSQL client |
| `dotenv` | Environment variable loading |
| `ts-node` | TypeScript runtime |

### Frontend (React Native / Expo)

| Package | Purpose |
|---|---|
| `mqtt` | MQTT client (connects to EMQX over WSS) |

### Removed

| Package | Was in | Reason |
|---|---|---|
| `eventsource` | Backend | Ingester deleted — Pi no longer SSE streams to backend |
| `react-native-sse` | Frontend | Replaced by `mqtt` package for EMQX connection |
