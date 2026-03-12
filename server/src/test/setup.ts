/**
 * Test setup helpers for Fastify integration tests.
 *
 * Creates an isolated in-memory SQLite database and Fastify app
 * for each test suite, so tests don't interfere with each other
 * or the real database.
 */
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "../db/schema.js";

export function createTestDb(): { db: ReturnType<typeof drizzle>; sqlite: InstanceType<typeof Database> } {
  const sqlite = new Database(":memory:");
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  // Create all tables manually (in-memory DB can't run migrations from files)
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      address TEXT,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      timezone TEXT NOT NULL DEFAULT 'America/Los_Angeles',
      hardiness_zone TEXT,
      last_frost_date TEXT,
      first_frost_date TEXT,
      lot_boundary TEXT,
      lot_width REAL,
      lot_depth REAL,
      compass_orientation REAL,
      sidewalks TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS structures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      location_id INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      pos_x REAL NOT NULL DEFAULT 0,
      pos_y REAL NOT NULL DEFAULT 0,
      width REAL NOT NULL,
      depth REAL NOT NULL,
      height REAL NOT NULL DEFAULT 10,
      stories INTEGER NOT NULL DEFAULT 1,
      roof_type TEXT NOT NULL DEFAULT 'gable',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS zones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      location_id INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      zone_type TEXT NOT NULL DEFAULT 'bed',
      climbing_structure TEXT,
      has_patio INTEGER NOT NULL DEFAULT 0,
      pos_x REAL NOT NULL DEFAULT 0,
      pos_y REAL NOT NULL DEFAULT 0,
      width REAL NOT NULL DEFAULT 10,
      depth REAL NOT NULL DEFAULT 10,
      sun_exposure TEXT DEFAULT 'partial_sun',
      soil_type TEXT,
      moisture_level TEXT,
      wind_exposure TEXT,
      is_indoor INTEGER NOT NULL DEFAULT 0,
      exposure TEXT NOT NULL DEFAULT 'outdoor',
      notes TEXT,
      notify_water INTEGER,
      notify_fertilize INTEGER,
      notify_prune INTEGER,
      notify_repot INTEGER,
      notify_inspect INTEGER,
      notify_protect INTEGER,
      color TEXT DEFAULT '#4ade80',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS plant_references (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      common_name TEXT NOT NULL,
      latin_name TEXT,
      cultivar TEXT,
      family TEXT,
      plant_type TEXT,
      sun_requirement TEXT,
      water_needs TEXT,
      soil_preference TEXT,
      hardiness_zone_min INTEGER,
      hardiness_zone_max INTEGER,
      mature_height TEXT,
      mature_spread TEXT,
      growth_rate TEXT,
      bloom_time TEXT,
      bloom_color TEXT,
      foliage_type TEXT,
      toxicity_dogs TEXT DEFAULT 'safe',
      toxicity_cats TEXT DEFAULT 'safe',
      toxicity_children TEXT DEFAULT 'safe',
      toxicity_notes TEXT,
      sprite_type TEXT DEFAULT 'flower',
      lifecycle TEXT,
      planting_notes TEXT,
      pruning_notes TEXT,
      overwintering_notes TEXT,
      native_region TEXT,
      deer_resistant INTEGER,
      drought_tolerant INTEGER,
      container_suitable INTEGER,
      attracts_pollinators INTEGER,
      attracts_birds INTEGER,
      attracts_butterflies INTEGER,
      companion_plants TEXT,
      min_temp_f INTEGER,
      max_temp_f INTEGER,
      source TEXT DEFAULT 'user',
      external_id TEXT,
      description TEXT,
      care_notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS plant_instances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plant_reference_id INTEGER NOT NULL REFERENCES plant_references(id),
      zone_id INTEGER REFERENCES zones(id) ON DELETE SET NULL,
      nickname TEXT,
      status TEXT NOT NULL DEFAULT 'planned',
      is_container INTEGER NOT NULL DEFAULT 0,
      container_description TEXT,
      date_planted TEXT,
      date_removed TEXT,
      notes TEXT,
      notify_water INTEGER,
      notify_fertilize INTEGER,
      notify_prune INTEGER,
      notify_repot INTEGER,
      notify_inspect INTEGER,
      notify_protect INTEGER,
      sprite_override TEXT,
      mood TEXT NOT NULL DEFAULT 'happy',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS plant_photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plant_instance_id INTEGER NOT NULL REFERENCES plant_instances(id) ON DELETE CASCADE,
      filename TEXT NOT NULL,
      caption TEXT,
      taken_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS care_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plant_instance_id INTEGER REFERENCES plant_instances(id) ON DELETE CASCADE,
      zone_id INTEGER REFERENCES zones(id) ON DELETE CASCADE,
      location_id INTEGER REFERENCES locations(id) ON DELETE CASCADE,
      task_type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      due_date TEXT,
      is_recurring INTEGER NOT NULL DEFAULT 0,
      interval_days INTEGER,
      active_months TEXT,
      send_notification INTEGER NOT NULL DEFAULT 1,
      last_notified_at TEXT,
      plant_message TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS care_task_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      care_task_id INTEGER NOT NULL REFERENCES care_tasks(id) ON DELETE CASCADE,
      action TEXT NOT NULL DEFAULT 'completed',
      notes TEXT,
      photo_id INTEGER REFERENCES plant_photos(id) ON DELETE SET NULL,
      rain_provisional INTEGER NOT NULL DEFAULT 0,
      completed_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS shopping_list_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      is_checked INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      plant_reference_id INTEGER REFERENCES plant_references(id),
      category TEXT,
      estimated_cost REAL,
      vendor_name TEXT,
      purchased_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS weather_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      location_id INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
      temperature REAL,
      temperature_high REAL,
      temperature_low REAL,
      humidity REAL,
      precipitation REAL,
      wind_speed REAL,
      conditions TEXT,
      forecast_json TEXT,
      uv_index REAL,
      precipitation_probability INTEGER,
      soil_temperature REAL,
      wind_gust REAL,
      fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS daily_weather (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      location_id INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      precipitation_forecast REAL,
      precipitation_actual REAL,
      temperature_high REAL,
      temperature_low REAL,
      conditions TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notification_channels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      config TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      quiet_hours_start TEXT,
      quiet_hours_end TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notification_preferences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_type TEXT NOT NULL UNIQUE,
      enabled INTEGER NOT NULL DEFAULT 1,
      digest_time TEXT DEFAULT '08:00',
      frequency TEXT NOT NULL DEFAULT 'daily_digest',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notification_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id INTEGER REFERENCES notification_channels(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      task_ids TEXT,
      success INTEGER NOT NULL,
      sent_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const db = drizzle(sqlite, { schema });
  return { db, sqlite };
}
