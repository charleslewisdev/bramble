import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "../db/schema.js";
import Fastify from "fastify";
import { almanacRoutes } from "./almanac.js";
import type { Role } from "../plugins/auth.js";

const sqlite = new Database(":memory:");
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

sqlite.exec(`
  CREATE TABLE almanac_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    excerpt TEXT,
    content TEXT NOT NULL DEFAULT '',
    created_by INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE almanac_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  );
  CREATE TABLE almanac_entry_tags (
    entry_id INTEGER NOT NULL REFERENCES almanac_entries(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES almanac_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (entry_id, tag_id)
  );
  CREATE TABLE almanac_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entry_id INTEGER NOT NULL REFERENCES almanac_entries(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

const testDb = drizzle(sqlite, { schema });

import * as dbModule from "../db/index.js";
Object.defineProperty(dbModule, "db", { value: testDb, writable: true });

const app = Fastify();
let currentRole: Role = "gardener";
app.decorateRequest("user", null);
app.decorateRequest("setupMode", false);
app.addHook("onRequest", async (request) => {
  request.user = { id: 1, username: "t", displayName: "T", role: currentRole };
  request.setupMode = false;
});

beforeAll(async () => {
  await app.register(almanacRoutes, { prefix: "/api/almanac" });
  await app.ready();
});

afterAll(async () => {
  await app.close();
  sqlite.close();
});

beforeEach(() => {
  sqlite.exec("DELETE FROM almanac_entry_tags");
  sqlite.exec("DELETE FROM almanac_images");
  sqlite.exec("DELETE FROM almanac_tags");
  sqlite.exec("DELETE FROM almanac_entries");
  currentRole = "gardener";
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function create(body: Record<string, unknown> = {}) {
  return app.inject({ method: "POST", url: "/api/almanac", payload: body });
}

async function list(query = "") {
  return app.inject({ method: "GET", url: `/api/almanac${query}` });
}

async function getBySlug(slug: string) {
  return app.inject({ method: "GET", url: `/api/almanac/${slug}` });
}

async function update(id: number, body: Record<string, unknown>) {
  return app.inject({ method: "PATCH", url: `/api/almanac/${id}`, payload: body });
}

async function del(id: number) {
  return app.inject({ method: "DELETE", url: `/api/almanac/${id}` });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("POST /api/almanac", () => {
  it("creates an entry with an auto-generated slug", async () => {
    const res = await create({ title: "My First Note" });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.slug).toBe("my-first-note");
    expect(body.title).toBe("My First Note");
    expect(body.content).toBe("");
    expect(body.tags).toEqual([]);
  });

  it("defaults to 'Untitled' when title omitted (stub-on-open)", async () => {
    const res = await create({});
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.title).toBe("Untitled");
    expect(body.slug).toMatch(/^untitled(-\d+)?$/);
  });

  it("generates unique slugs on collision", async () => {
    const a = await create({ title: "Dahlias" });
    const b = await create({ title: "Dahlias" });
    expect(a.json().slug).toBe("dahlias");
    expect(b.json().slug).toBe("dahlias-2");
  });

  it("creates and associates tags", async () => {
    const res = await create({ title: "Soil", tags: ["SOIL", "amendments"] });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.tags.sort()).toEqual(["amendments", "soil"]);
  });
});

describe("GET /api/almanac", () => {
  it("lists entries sorted by updated_at desc", async () => {
    await create({ title: "First" });
    // Nudge timestamps so order is deterministic
    sqlite.prepare("UPDATE almanac_entries SET updated_at = '2026-04-17T00:00:00Z'").run();
    await create({ title: "Second" });

    const res = await list();
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.entries).toHaveLength(2);
    expect(body.entries[0].title).toBe("Second");
    expect(body.entries[1].title).toBe("First");
  });

  it("filters by tag", async () => {
    await create({ title: "Composting", tags: ["soil"] });
    await create({ title: "Dahlias", tags: ["flowers"] });
    const res = await list("?tag=soil");
    const body = res.json();
    expect(body.entries).toHaveLength(1);
    expect(body.entries[0].title).toBe("Composting");
  });

  it("returns tag counts", async () => {
    await create({ title: "A", tags: ["soil"] });
    await create({ title: "B", tags: ["soil", "flowers"] });
    const res = await list();
    const body = res.json();
    const soil = body.tags.find((t: { name: string }) => t.name === "soil");
    const flowers = body.tags.find((t: { name: string }) => t.name === "flowers");
    expect(soil.count).toBe(2);
    expect(flowers.count).toBe(1);
  });
});

describe("GET /api/almanac/:slug", () => {
  it("returns the entry with tags", async () => {
    await create({ title: "Roses", content: "# Roses\n\nPrune in late winter.", tags: ["flowers"] });
    const res = await getBySlug("roses");
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.title).toBe("Roses");
    expect(body.content).toMatch(/Prune in late winter/);
    expect(body.tags).toEqual(["flowers"]);
  });

  it("404s for missing slug", async () => {
    const res = await getBySlug("nope");
    expect(res.statusCode).toBe(404);
  });
});

describe("PATCH /api/almanac/:id", () => {
  it("updates title, content, excerpt without changing slug", async () => {
    const created = await create({ title: "Dahlias" });
    const id = created.json().id;
    const originalSlug = created.json().slug;

    const res = await update(id, {
      title: "Overwintering Dahlias",
      content: "Dig them up.",
      excerpt: "How to overwinter",
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.title).toBe("Overwintering Dahlias");
    expect(body.slug).toBe(originalSlug);
    expect(body.content).toBe("Dig them up.");
    expect(body.excerpt).toBe("How to overwinter");
  });

  it("replaces the tag set", async () => {
    const created = await create({ title: "X", tags: ["a", "b"] });
    const id = created.json().id;
    const res = await update(id, { tags: ["c"] });
    expect(res.json().tags).toEqual(["c"]);

    // Removing tag 'a' / 'b' should also orphan-cleanup: list tags shouldn't include them
    const listRes = await list();
    const names = listRes.json().tags.map((t: { name: string }) => t.name);
    expect(names).toContain("c");
    expect(names).not.toContain("a");
    expect(names).not.toContain("b");
  });

  it("404s for missing id", async () => {
    const res = await update(9999, { title: "x" });
    expect(res.statusCode).toBe(404);
  });

  it("regenerates slug when renaming a stub from 'Untitled'", async () => {
    const stub = await create({});
    expect(stub.json().slug).toBe("untitled");

    const res = await update(stub.json().id, { title: "Overwintering Dahlias" });
    expect(res.statusCode).toBe(200);
    expect(res.json().slug).toBe("overwintering-dahlias");
  });

  it("keeps slug stable when renaming an already-named entry", async () => {
    const entry = await create({ title: "Dahlias" });
    const id = entry.json().id;
    const originalSlug = entry.json().slug;

    const res = await update(id, { title: "Dahlias, updated" });
    expect(res.json().slug).toBe(originalSlug);
  });
});

describe("DELETE /api/almanac/:id", () => {
  it("deletes the entry and cascades tag links", async () => {
    const created = await create({ title: "Gone", tags: ["temp"] });
    const id = created.json().id;

    currentRole = "gardener";
    const res = await del(id);
    expect(res.statusCode).toBe(204);

    const get = await getBySlug("gone");
    expect(get.statusCode).toBe(404);
  });

  it("requires gardener role", async () => {
    const created = await create({ title: "Protected" });
    const id = created.json().id;

    currentRole = "helper";
    const res = await del(id);
    expect(res.statusCode).toBe(403);
  });
});
