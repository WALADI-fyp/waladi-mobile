/**
 * Database module — PostgreSQL / TimescaleDB connection pool.
 *
 * Exposes a `pool` for queries and `initDb()` to create the
 * sensor_readings hypertable and user_devices table if they don't already exist.
 */

import { Pool } from "pg";
import { DB_CONFIG } from "./config";

export const pool = new Pool(DB_CONFIG);

const CREATE_SENSOR_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS sensor_readings (
    time                TIMESTAMPTZ      NOT NULL,
    source              TEXT             NOT NULL,
    heart_rate_bpm      DOUBLE PRECISION,
    breathing_rate_bpm  DOUBLE PRECISION,
    room_temperature_c  DOUBLE PRECISION,
    body_temperature_c  DOUBLE PRECISION,
    room_humidity_rh    DOUBLE PRECISION,
    mock_fields         TEXT[],
    device_id           TEXT,
    user_id             TEXT
  );
`;

const CREATE_HYPERTABLE_SQL = `
  SELECT create_hypertable('sensor_readings', 'time', if_not_exists => TRUE);
`;

const CREATE_USER_DEVICES_SQL = `
  CREATE TABLE IF NOT EXISTS user_devices (
    id         SERIAL PRIMARY KEY,
    user_id    TEXT NOT NULL,
    device_id  TEXT NOT NULL UNIQUE,
    name       TEXT DEFAULT 'My Device',
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
`;

const ADD_MISSING_COLUMNS_SQL = `
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'sensor_readings' AND column_name = 'device_id'
    ) THEN
      ALTER TABLE sensor_readings ADD COLUMN device_id TEXT;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'sensor_readings' AND column_name = 'user_id'
    ) THEN
      ALTER TABLE sensor_readings ADD COLUMN user_id TEXT;
    END IF;
  END $$;
`;

const CREATE_INDEXES_SQL = `
  CREATE INDEX IF NOT EXISTS idx_user_devices_user_id ON user_devices (user_id);
  CREATE INDEX IF NOT EXISTS idx_sensor_readings_user_time ON sensor_readings (user_id, time DESC);
`;

export async function initDb(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(CREATE_SENSOR_TABLE_SQL);
    await client.query(CREATE_HYPERTABLE_SQL);
    await client.query(CREATE_USER_DEVICES_SQL);
    await client.query(ADD_MISSING_COLUMNS_SQL);
    await client.query(CREATE_INDEXES_SQL);
    console.log("[db] sensor_readings hypertable ready");
    console.log("[db] user_devices table ready");
  } finally {
    client.release();
  }
}
