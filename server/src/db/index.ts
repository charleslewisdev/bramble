import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema.js";
import { existsSync, mkdirSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const dbPath = process.env.DATABASE_URL ?? "./data/bramble.db";
const dir = dirname(dbPath);
if (!existsSync(dir)) {
  mkdirSync(dir, { recursive: true });
}

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
export { schema };

// Auto-run migrations on startup
const migrationsFolder = resolve(__dirname, "../../drizzle");
if (existsSync(migrationsFolder)) {
  try {
    migrate(db, { migrationsFolder });
    console.log("Database migrations applied successfully");
  } catch (err) {
    console.error("Migration failed:", err);
    throw err;
  }
}
