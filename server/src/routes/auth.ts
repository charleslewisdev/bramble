import { FastifyInstance } from "fastify";
import { z } from "zod";
import { db, schema } from "../db/index.js";
import { eq, count } from "drizzle-orm";
import {
  hashPassword,
  verifyPassword,
  generateSessionToken,
  SESSION_MAX_AGE_MS,
} from "../services/auth.js";
import { requireAuth, markSetupComplete } from "../plugins/auth.js";

const SESSION_COOKIE = "bramble_session";

function cookieOptions(maxAge?: number) {
  // Secure flag requires HTTPS — only enable when explicitly configured,
  // not based on NODE_ENV (self-hosted instances often run HTTP behind a proxy)
  const secure = process.env.COOKIE_SECURE === "true";
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
    maxAge: maxAge ?? Math.floor(SESSION_MAX_AGE_MS / 1000),
  };
}

const setupSchema = z.object({
  username: z.string().min(2).max(50).regex(/^[a-zA-Z0-9_-]+$/, "Username must be alphanumeric, hyphens, or underscores"),
  displayName: z.string().min(1).max(100),
  password: z.string().min(8).max(128),
});

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

async function createSession(userId: number, userAgent?: string): Promise<string> {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_MS).toISOString();
  db.insert(schema.sessions).values({
    id: token,
    userId,
    expiresAt,
    userAgent: userAgent ?? null,
  }).run();
  return token;
}

function userResponse(user: typeof schema.users.$inferSelect) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    email: user.email,
    avatarUrl: user.avatarUrl,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
  };
}

export async function authRoutes(app: FastifyInstance) {
  // GET /me — current user or auth status
  app.get("/me", async (request, reply) => {
    if (request.setupMode) {
      return reply.status(200).send({ user: null, setupMode: true });
    }
    if (!request.user) {
      return reply.status(401).send({ error: "Not authenticated" });
    }
    const user = db.select().from(schema.users).where(eq(schema.users.id, request.user.id)).get();
    if (!user) return reply.status(401).send({ error: "Not authenticated" });
    return userResponse(user);
  });

  // POST /setup — first-run: create Groundskeeper account
  app.post("/setup", async (request, reply) => {
    const result = db.select({ total: count() }).from(schema.users).get();
    if (result && result.total > 0) {
      return reply.status(403).send({ error: "Setup already completed" });
    }

    const body = setupSchema.parse(request.body);
    const passwordHash = await hashPassword(body.password);

    const user = db.insert(schema.users).values({
      username: body.username,
      displayName: body.displayName,
      passwordHash,
      role: "groundskeeper",
    }).returning().get();

    const token = await createSession(user.id, request.headers["user-agent"]);
    markSetupComplete();

    reply.setCookie(SESSION_COOKIE, token, cookieOptions());
    return reply.status(201).send(userResponse(user));
  });

  // POST /login
  app.post("/login", async (request, reply) => {
    const body = loginSchema.parse(request.body);

    const user = db.select().from(schema.users)
      .where(eq(schema.users.username, body.username))
      .get();

    if (!user || !user.isActive) {
      return reply.status(401).send({ error: "Invalid credentials" });
    }

    const valid = await verifyPassword(body.password, user.passwordHash);
    if (!valid) {
      return reply.status(401).send({ error: "Invalid credentials" });
    }

    // Update last login
    db.update(schema.users)
      .set({ lastLoginAt: new Date().toISOString() })
      .where(eq(schema.users.id, user.id))
      .run();

    const token = await createSession(user.id, request.headers["user-agent"]);

    reply.setCookie(SESSION_COOKIE, token, cookieOptions());
    return userResponse(user);
  });

  // POST /logout
  app.post("/logout", { preHandler: requireAuth }, async (request, reply) => {
    const token = request.cookies.bramble_session;
    if (token) {
      db.delete(schema.sessions).where(eq(schema.sessions.id, token)).run();
    }
    reply.clearCookie(SESSION_COOKIE, { path: "/" });
    return reply.status(204).send();
  });

  // PUT /password — change own password
  app.put("/password", { preHandler: requireAuth }, async (request, reply) => {
    const body = passwordSchema.parse(request.body);

    const user = db.select().from(schema.users)
      .where(eq(schema.users.id, request.user!.id))
      .get();

    if (!user) {
      return reply.status(401).send({ error: "Not authenticated" });
    }

    const valid = await verifyPassword(body.currentPassword, user.passwordHash);
    if (!valid) {
      return reply.status(400).send({ error: "Current password is incorrect" });
    }

    const newHash = await hashPassword(body.newPassword);
    db.update(schema.users)
      .set({ passwordHash: newHash, updatedAt: new Date().toISOString() })
      .where(eq(schema.users.id, user.id))
      .run();

    return reply.status(200).send({ message: "Password updated" });
  });
}
