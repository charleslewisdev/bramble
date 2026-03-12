-- Add exposure column
ALTER TABLE zones ADD COLUMN exposure TEXT NOT NULL DEFAULT 'outdoor';--> statement-breakpoint
-- Backfill from isIndoor
UPDATE zones SET exposure = 'indoor' WHERE is_indoor = 1;--> statement-breakpoint
-- Add rainProvisional to care_task_logs
ALTER TABLE care_task_logs ADD COLUMN rain_provisional INTEGER NOT NULL DEFAULT 0;--> statement-breakpoint
-- Create daily_weather table
CREATE TABLE daily_weather (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  location_id INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  precipitation_forecast REAL,
  precipitation_actual REAL,
  temperature_high REAL,
  temperature_low REAL,
  conditions TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);--> statement-breakpoint
CREATE INDEX daily_weather_location_date_idx ON daily_weather(location_id, date);--> statement-breakpoint
-- Auto-create Indoors zone for existing locations that don't have one
INSERT INTO zones (location_id, name, zone_type, exposure, pos_x, pos_y, width, depth, created_at, updated_at)
SELECT l.id, 'Indoors', 'indoor', 'indoor', 0, 0, 10, 10, datetime('now'), datetime('now')
FROM locations l
WHERE NOT EXISTS (
  SELECT 1 FROM zones z WHERE z.location_id = l.id AND z.is_indoor = 1
);
