import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "../db/schema.js";
import Fastify from "fastify";
import { shoppingListRoutes } from "./shopping-list.js";

// Create in-memory test database directly — bypass the db module
const sqlite = new Database(":memory:");
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS shopping_list_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    is_checked INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    plant_reference_id INTEGER,
    category TEXT,
    estimated_cost REAL,
    vendor_name TEXT,
    purchased_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

const testDb = drizzle(sqlite, { schema });

// Monkey-patch the db module export before routes are registered
import * as dbModule from "../db/index.js";
Object.defineProperty(dbModule, "db", { value: testDb, writable: true });

const app = Fastify();

beforeAll(async () => {
  await app.register(shoppingListRoutes, { prefix: "/api/shopping-list" });
  await app.ready();
});

afterAll(async () => {
  await app.close();
  sqlite.close();
});

beforeEach(() => {
  sqlite.exec("DELETE FROM shopping_list_items");
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function createItem(body: Record<string, unknown>) {
  return app.inject({
    method: "POST",
    url: "/api/shopping-list",
    payload: body,
  });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("Shopping List API", () => {
  describe("POST /api/shopping-list", () => {
    it("creates a new item with minimal fields", async () => {
      const res = await createItem({ name: "Potting soil" });
      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.name).toBe("Potting soil");
      expect(body.id).toBeGreaterThan(0);
      expect(body.quantity).toBe(1);
      expect(body.isChecked).toBe(false);
    });

    it("creates an item with all optional fields", async () => {
      const res = await createItem({
        name: "Lavender plant",
        quantity: 3,
        notes: "For the front bed",
        category: "plant",
        estimatedCost: 12.99,
        vendorName: "Portland Nursery",
      });
      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.name).toBe("Lavender plant");
      expect(body.quantity).toBe(3);
      expect(body.notes).toBe("For the front bed");
    });

    it("rejects empty name", async () => {
      const res = await createItem({ name: "" });
      expect(res.statusCode).toBe(400);
    });

    it("rejects missing name", async () => {
      const res = await createItem({});
      expect(res.statusCode).toBe(400);
    });

    it("rejects invalid category", async () => {
      const res = await createItem({ name: "Test", category: "invalid" });
      expect(res.statusCode).toBe(400);
    });

    it("rejects non-positive quantity", async () => {
      const res = await createItem({ name: "Test", quantity: 0 });
      expect(res.statusCode).toBe(400);
    });

    it("rejects negative estimated cost", async () => {
      const res = await createItem({ name: "Test", estimatedCost: -5 });
      expect(res.statusCode).toBe(400);
    });
  });

  describe("GET /api/shopping-list", () => {
    it("returns empty array when no items exist", async () => {
      const res = await app.inject({ method: "GET", url: "/api/shopping-list" });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual([]);
    });

    it("returns all items", async () => {
      await createItem({ name: "Item 1" });
      await createItem({ name: "Item 2" });

      const res = await app.inject({ method: "GET", url: "/api/shopping-list" });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toHaveLength(2);
    });

    it("returns unchecked items before checked items", async () => {
      const first = await createItem({ name: "First" });
      await createItem({ name: "Second" });

      await app.inject({
        method: "PATCH",
        url: `/api/shopping-list/${first.json().id}/toggle`,
      });

      const res = await app.inject({ method: "GET", url: "/api/shopping-list" });
      const items = res.json();
      expect(items[0].name).toBe("Second");
      expect(items[0].isChecked).toBe(false);
      expect(items[1].name).toBe("First");
      expect(items[1].isChecked).toBe(true);
    });
  });

  describe("PUT /api/shopping-list/:id", () => {
    it("updates an existing item", async () => {
      const created = await createItem({ name: "Old name" });
      const id = created.json().id;

      const res = await app.inject({
        method: "PUT",
        url: `/api/shopping-list/${id}`,
        payload: { name: "New name", quantity: 5 },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().name).toBe("New name");
      expect(res.json().quantity).toBe(5);
    });

    it("returns 404 for non-existent item", async () => {
      const res = await app.inject({
        method: "PUT",
        url: "/api/shopping-list/99999",
        payload: { name: "Ghost" },
      });
      expect(res.statusCode).toBe(404);
    });

    it("returns 400 for invalid ID", async () => {
      const res = await app.inject({
        method: "PUT",
        url: "/api/shopping-list/abc",
        payload: { name: "Invalid" },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe("PATCH /api/shopping-list/:id/toggle", () => {
    it("toggles checked status", async () => {
      const created = await createItem({ name: "Toggle test" });
      const id = created.json().id;
      expect(created.json().isChecked).toBe(false);

      const res = await app.inject({ method: "PATCH", url: `/api/shopping-list/${id}/toggle` });
      expect(res.statusCode).toBe(200);
      expect(res.json().isChecked).toBe(true);

      const res2 = await app.inject({ method: "PATCH", url: `/api/shopping-list/${id}/toggle` });
      expect(res2.json().isChecked).toBe(false);
    });

    it("returns 404 for non-existent item", async () => {
      const res = await app.inject({ method: "PATCH", url: "/api/shopping-list/99999/toggle" });
      expect(res.statusCode).toBe(404);
    });
  });

  describe("DELETE /api/shopping-list/:id", () => {
    it("deletes an existing item", async () => {
      const created = await createItem({ name: "Delete me" });
      const id = created.json().id;

      const res = await app.inject({ method: "DELETE", url: `/api/shopping-list/${id}` });
      expect(res.statusCode).toBe(204);

      const list = await app.inject({ method: "GET", url: "/api/shopping-list" });
      expect(list.json()).toHaveLength(0);
    });

    it("returns 404 for non-existent item", async () => {
      const res = await app.inject({ method: "DELETE", url: "/api/shopping-list/99999" });
      expect(res.statusCode).toBe(404);
    });
  });

  describe("DELETE /api/shopping-list/clear-checked", () => {
    it("clears all checked items", async () => {
      await createItem({ name: "Keep me" });
      const toCheck = await createItem({ name: "Clear me" });
      const toCheck2 = await createItem({ name: "Also clear" });

      await app.inject({ method: "PATCH", url: `/api/shopping-list/${toCheck.json().id}/toggle` });
      await app.inject({ method: "PATCH", url: `/api/shopping-list/${toCheck2.json().id}/toggle` });

      const res = await app.inject({ method: "DELETE", url: "/api/shopping-list/clear-checked" });
      expect(res.statusCode).toBe(204);

      const list = await app.inject({ method: "GET", url: "/api/shopping-list" });
      expect(list.json()).toHaveLength(1);
      expect(list.json()[0].name).toBe("Keep me");
    });
  });
});
