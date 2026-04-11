import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "../db/schema.js";
import Fastify from "fastify";
import { careTaskRoutes } from "./care-tasks.js";
import type { Role } from "../plugins/auth.js";

// Minimal in-memory schema — just what the route touches
const sqlite = new Database(":memory:");
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
sqlite.exec(`
  CREATE TABLE care_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plant_instance_id INTEGER,
    zone_id INTEGER,
    location_id INTEGER,
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
    completed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE care_task_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    care_task_id INTEGER NOT NULL REFERENCES care_tasks(id) ON DELETE CASCADE,
    action TEXT NOT NULL DEFAULT 'completed',
    notes TEXT,
    photo_id INTEGER,
    created_by INTEGER,
    rain_provisional INTEGER NOT NULL DEFAULT 0,
    completed_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE journal_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plant_instance_id INTEGER,
    zone_id INTEGER,
    location_id INTEGER,
    entry_type TEXT NOT NULL,
    title TEXT,
    body TEXT,
    care_task_log_id INTEGER,
    created_by INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now') || 'Z')
  );
  CREATE TABLE journal_photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    journal_entry_id INTEGER NOT NULL,
    plant_photo_id INTEGER NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE plant_instances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    status TEXT NOT NULL DEFAULT 'planted'
  );
`);

const testDb = drizzle(sqlite, { schema });

import * as dbModule from "../db/index.js";
Object.defineProperty(dbModule, "db", { value: testDb, writable: true });

const app = Fastify();
app.decorateRequest("user", null);
app.decorateRequest("setupMode", false);
app.addHook("onRequest", async (request) => {
  request.user = { id: 1, username: "t", displayName: "T", role: "gardener" as Role };
  request.setupMode = false;
});

beforeAll(async () => {
  await app.register(careTaskRoutes, { prefix: "/api/care-tasks" });
  await app.ready();
});

afterAll(async () => {
  await app.close();
  sqlite.close();
});

beforeEach(() => {
  sqlite.exec("DELETE FROM care_task_logs; DELETE FROM journal_entries; DELETE FROM care_tasks; DELETE FROM plant_instances;");
});

function createTask(partial: {
  title: string;
  task_type?: string;
  is_recurring?: number;
  interval_days?: number | null;
  due_date?: string | null;
}) {
  const r = sqlite
    .prepare(
      `INSERT INTO care_tasks (title, task_type, is_recurring, interval_days, due_date)
       VALUES (?, ?, ?, ?, ?) RETURNING id`,
    )
    .get(
      partial.title,
      partial.task_type ?? "prune",
      partial.is_recurring ?? 0,
      partial.interval_days ?? null,
      partial.due_date ?? "2026-04-01",
    ) as { id: number };
  return r.id;
}

describe("Care tasks completion", () => {
  it("marks a one-time task completed and hides it from the default list", async () => {
    const id = createTask({ title: "Remove pampas", is_recurring: 0 });

    const logRes = await app.inject({
      method: "POST",
      url: `/api/care-tasks/${id}/log`,
      payload: { action: "completed" },
    });
    expect(logRes.statusCode).toBe(201);

    // Task should now have completedAt set
    const row = sqlite.prepare("SELECT completed_at, is_recurring FROM care_tasks WHERE id = ?").get(id) as { completed_at: string | null; is_recurring: number };
    expect(row.completed_at).not.toBeNull();

    // Default list should not include it
    const listRes = await app.inject({ method: "GET", url: "/api/care-tasks" });
    expect(listRes.statusCode).toBe(200);
    const tasks = listRes.json() as Array<{ id: number }>;
    expect(tasks.find((t) => t.id === id)).toBeUndefined();
  });

  it("includes completed tasks when includeCompleted=true", async () => {
    const id = createTask({ title: "Call Mt Scott Fuel", is_recurring: 0 });
    await app.inject({
      method: "POST",
      url: `/api/care-tasks/${id}/log`,
      payload: { action: "completed" },
    });

    const listRes = await app.inject({ method: "GET", url: "/api/care-tasks?includeCompleted=true" });
    const tasks = listRes.json() as Array<{ id: number }>;
    expect(tasks.find((t) => t.id === id)).toBeDefined();
  });

  it("also hides skipped one-time tasks from the default list", async () => {
    const id = createTask({ title: "Skipped thing", is_recurring: 0 });
    await app.inject({
      method: "POST",
      url: `/api/care-tasks/${id}/log`,
      payload: { action: "skipped" },
    });

    const listRes = await app.inject({ method: "GET", url: "/api/care-tasks" });
    const tasks = listRes.json() as Array<{ id: number }>;
    expect(tasks.find((t) => t.id === id)).toBeUndefined();
  });

  it("keeps a recurring task visible after completion (advances due date)", async () => {
    const id = createTask({
      title: "Weekly watering",
      is_recurring: 1,
      interval_days: 7,
      due_date: "2026-01-01",
    });

    await app.inject({
      method: "POST",
      url: `/api/care-tasks/${id}/log`,
      payload: { action: "completed" },
    });

    const row = sqlite
      .prepare("SELECT completed_at, due_date FROM care_tasks WHERE id = ?")
      .get(id) as { completed_at: string | null; due_date: string };
    expect(row.completed_at).toBeNull();
    expect(row.due_date).not.toBe("2026-01-01"); // advanced

    const listRes = await app.inject({ method: "GET", url: "/api/care-tasks" });
    const tasks = listRes.json() as Array<{ id: number }>;
    expect(tasks.find((t) => t.id === id)).toBeDefined();
  });

  it("hides one-time tasks via bulk log completion", async () => {
    const ids = [
      createTask({ title: "Task A", is_recurring: 0 }),
      createTask({ title: "Task B", is_recurring: 0 }),
    ];

    await app.inject({
      method: "POST",
      url: "/api/care-tasks/bulk/log",
      payload: { ids, action: "completed" },
    });

    const listRes = await app.inject({ method: "GET", url: "/api/care-tasks" });
    const tasks = listRes.json() as Array<{ id: number }>;
    expect(tasks.find((t) => t.id === ids[0])).toBeUndefined();
    expect(tasks.find((t) => t.id === ids[1])).toBeUndefined();
  });
});
