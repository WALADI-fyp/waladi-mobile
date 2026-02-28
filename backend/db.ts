/**
 * Database module — PostgreSQL / TimescaleDB connection pool.
 *
 * Exposes a `pool` for queries and `initDb()` to create the
 * sensor_readings hypertable if it doesn't already exist.
 */

import { Pool } from "pg";
import { DB_CONFIG } from "./config";

export const pool = new Pool(DB_CONFIG);

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS sensor_readings (
    time                TIMESTAMPTZ      NOT NULL,
    source              TEXT             NOT NULL,
    heart_rate_bpm      DOUBLE PRECISION,
    breathing_rate_bpm  DOUBLE PRECISION,
    room_temperature_c  DOUBLE PRECISION,
    body_temperature_c  DOUBLE PRECISION,
    room_humidity_rh    DOUBLE PRECISION,
    mock_fields         TEXT[]
  );
`;

const CREATE_HYPERTABLE_SQL = `
  SELECT create_hypertable('sensor_readings', 'time', if_not_exists => TRUE);
`;

export async function initDb(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(CREATE_TABLE_SQL);
    await client.query(CREATE_HYPERTABLE_SQL);
    console.log("[db] sensor_readings hypertable ready");
  } finally {
    client.release();
  }
}
