-- WALDI Database Migration
-- Run this against your sensors_db to add user/device support.
-- Safe to re-run (all statements use IF NOT EXISTS).

-- 1. user_devices — links a Clerk user to a Pi
CREATE TABLE IF NOT EXISTS user_devices (
  id         SERIAL PRIMARY KEY,
  user_id    TEXT NOT NULL,
  device_id  TEXT NOT NULL UNIQUE,
  name       TEXT DEFAULT 'My Device',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_devices_user_id ON user_devices (user_id);

-- 2. Add device_id + user_id columns to sensor_readings (if missing)
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

-- 3. Index for fast per-user queries
CREATE INDEX IF NOT EXISTS idx_sensor_readings_user_time ON sensor_readings (user_id, time DESC);
