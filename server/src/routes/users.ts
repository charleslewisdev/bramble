import { FastifyInstance } from "fastify";
import { z } from "zod";
import { db, schema } from "../db/index.js";
import { eq, and, ne } from "drizzle-orm";
import { requireRole, requireAuth } from "../plugins/auth.js";
import { idParamSchema } from "../lib/validation.js";

const roleSchema = z.object({
  role: z.enum(["groundskeeper", "gardener", "helper"]),
});

const activeSchema = z.object({
  isActive: z.boolean(),
});

function safeUser(user: typeof schema.users.$inferSelect) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    email: user.email,
    avatarUrl: user.avatarUrl,
    lastLoginAt: user.lastLoginAt,
    isActive: user.isActive,
    createdAt: user.createdAt,
  };
}

export async function userRoutes(app: FastifyInstance) {
  // GET / — Groundskeeper: list all users
  app.get("/", { preHandler: requireRole("groundskeeper") }, async () => {
    const users = db.select().from(schema.users).all();
    return users.map(safeUser);
  });

  // PUT /:id/role — Groundskeeper: change user role
  app.put("/:id/role", { preHandler: requireRole("groundskeeper") }, async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    const userId = Number(id);

    if (userId === request.user!.id) {
      return reply.status(400).send({ error: "Cannot change your own role" });
    }

    const body = roleSchema.parse(request.body);

    const user = db.select().from(schema.users).where(eq(schema.users.id, userId)).get();
    if (!user) {
      return reply.status(404).send({ error: "User not found" });
    }

    db.update(schema.users)
      .set({ role: body.role, updatedAt: new Date().toISOString() })
      .where(eq(schema.users.id, userId))
      .run();

    const updated = db.select().from(schema.users).where(eq(schema.users.id, userId)).get()!;
    return safeUser(updated);
  });

  // PUT /:id/active — Groundskeeper: activate/deactivate user
  app.put("/:id/active", { preHandler: requireRole("groundskeeper") }, async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    const userId = Number(id);

    if (userId === request.user!.id) {
      return reply.status(400).send({ error: "Cannot deactivate yourself" });
    }

    const body = activeSchema.parse(request.body);

    const user = db.select().from(schema.users).where(eq(schema.users.id, userId)).get();
    if (!user) {
      return reply.status(404).send({ error: "User not found" });
    }

    db.update(schema.users)
      .set({ isActive: body.isActive, updatedAt: new Date().toISOString() })
      .where(eq(schema.users.id, userId))
      .run();

    // If deactivating, delete their sessions
    if (!body.isActive) {
      db.delete(schema.sessions).where(eq(schema.sessions.userId, userId)).run();
    }

    const updated = db.select().from(schema.users).where(eq(schema.users.id, userId)).get()!;
    return safeUser(updated);
  });

  // GET /sessions — Groundskeeper: all sessions; others: own sessions
  // Never expose raw session tokens — return createdAt as the identifier
  app.get("/sessions", { preHandler: requireAuth }, async (request) => {
    function safeSession(s: { userId: number; userAgent: string | null; expiresAt: string; createdAt: string }) {
      return { createdAt: s.createdAt, userId: s.userId, userAgent: s.userAgent, expiresAt: s.expiresAt };
    }
    if (request.user!.role === "groundskeeper") {
      return db.select({
        userId: schema.sessions.userId,
        userAgent: schema.sessions.userAgent,
        expiresAt: schema.sessions.expiresAt,
        createdAt: schema.sessions.createdAt,
      }).from(schema.sessions).all().map(safeSession);
    }
    return db.select({
      userId: schema.sessions.userId,
      userAgent: schema.sessions.userAgent,
      expiresAt: schema.sessions.expiresAt,
      createdAt: schema.sessions.createdAt,
    }).from(schema.sessions)
      .where(eq(schema.sessions.userId, request.user!.id))
      .all().map(safeSession);
  });

  // DELETE /sessions/:createdAt — Groundskeeper: any; others: own only
  // Uses createdAt timestamp as identifier to avoid exposing session tokens in URLs
  app.delete("/sessions/:createdAt", { preHandler: requireAuth }, async (request, reply) => {
    const { createdAt } = request.params as { createdAt: string };

    const session = db.select().from(schema.sessions)
      .where(eq(schema.sessions.createdAt, createdAt))
      .get();

    if (!session) {
      return reply.status(404).send({ error: "Session not found" });
    }

    // Non-groundskeepers can only delete their own sessions
    if (request.user!.role !== "groundskeeper" && session.userId !== request.user!.id) {
      return reply.status(403).send({ error: "Insufficient permissions" });
    }

    db.delete(schema.sessions).where(eq(schema.sessions.createdAt, createdAt)).run();
    return reply.status(204).send();
  });
}
