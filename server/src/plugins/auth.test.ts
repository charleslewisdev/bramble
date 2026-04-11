import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "../db/schema.js";
import Fastify from "fastify";
import { authPlugin } from "./auth.js";
import { generateApiKey, hashApiKey, apiKeyPrefix, hashPassword } from "../services/auth.js";

// In-memory test database — patches the db module export
const sqlite = new Database(":memory:");
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    email TEXT UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL,
    avatar_url TEXT,
    last_login_at TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS api_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    key_hash TEXT NOT NULL UNIQUE,
    key_prefix TEXT NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_used_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL,
    user_agent TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

const testDb = drizzle(sqlite, { schema });

import * as dbModule from "../db/index.js";
Object.defineProperty(dbModule, "db", { value: testDb, writable: true });

const app = Fastify();

// Mount auth plugin and a protected echo route to observe request.user
beforeAll(async () => {
  await app.register(authPlugin);
  app.get("/echo", async (request) => ({
    user: request.user,
    setupMode: request.setupMode,
  }));
  await app.ready();
});

afterAll(async () => {
  await app.close();
  sqlite.close();
});

beforeEach(() => {
  sqlite.exec("DELETE FROM api_keys; DELETE FROM sessions; DELETE FROM users;");
});

async function createTestUser() {
  const passwordHash = await hashPassword("test-password");
  const result = sqlite
    .prepare(
      "INSERT INTO users (username, display_name, password_hash, role) VALUES (?, ?, ?, ?) RETURNING id",
    )
    .get("tester", "Tester", passwordHash, "gardener") as { id: number };
  return result.id;
}

function insertApiKey(userId: number, key: string) {
  sqlite
    .prepare(
      "INSERT INTO api_keys (name, key_hash, key_prefix, user_id) VALUES (?, ?, ?, ?)",
    )
    .run("test-key", hashApiKey(key), apiKeyPrefix(key), userId);
}

describe("authPlugin", () => {
  describe("brk_ API key Bearer auth", () => {
    it("authenticates with a valid brk_ key and sets request.user", async () => {
      const userId = await createTestUser();
      const key = generateApiKey();
      insertApiKey(userId, key);

      const res = await app.inject({
        method: "GET",
        url: "/echo",
        headers: { authorization: `Bearer ${key}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.user).toMatchObject({
        id: userId,
        username: "tester",
        role: "gardener",
      });
    });

    it("leaves request.user null for an unknown brk_ key", async () => {
      await createTestUser();

      const res = await app.inject({
        method: "GET",
        url: "/echo",
        headers: { authorization: "Bearer brk_nosuchkey_abcdef" },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().user).toBeNull();
    });

    it("leaves request.user null for non-brk_ Bearer tokens", async () => {
      await createTestUser();

      const res = await app.inject({
        method: "GET",
        url: "/echo",
        headers: { authorization: "Bearer not-a-brk-key" },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().user).toBeNull();
    });

    it("does not authenticate inactive users", async () => {
      const userId = await createTestUser();
      sqlite.prepare("UPDATE users SET is_active = 0 WHERE id = ?").run(userId);
      const key = generateApiKey();
      insertApiKey(userId, key);

      const res = await app.inject({
        method: "GET",
        url: "/echo",
        headers: { authorization: `Bearer ${key}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().user).toBeNull();
    });

    it("updates last_used_at on successful key auth", async () => {
      const userId = await createTestUser();
      const key = generateApiKey();
      insertApiKey(userId, key);

      const before = sqlite
        .prepare("SELECT last_used_at FROM api_keys WHERE user_id = ?")
        .get(userId) as { last_used_at: string | null };
      expect(before.last_used_at).toBeNull();

      await app.inject({
        method: "GET",
        url: "/echo",
        headers: { authorization: `Bearer ${key}` },
      });

      const after = sqlite
        .prepare("SELECT last_used_at FROM api_keys WHERE user_id = ?")
        .get(userId) as { last_used_at: string | null };
      expect(after.last_used_at).not.toBeNull();
    });
  });

  describe("no auth header", () => {
    it("leaves request.user null when no header is provided", async () => {
      await createTestUser();

      const res = await app.inject({ method: "GET", url: "/echo" });
      expect(res.statusCode).toBe(200);
      expect(res.json().user).toBeNull();
    });
  });
});
