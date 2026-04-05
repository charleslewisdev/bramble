import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fastifyCookie from "@fastify/cookie";
import { db, schema } from "../db/index.js";
import { eq, and, gt, count } from "drizzle-orm";

// Role hierarchy: higher index = more power
const ROLE_LEVELS = { helper: 0, gardener: 1, groundskeeper: 2 } as const;
export type Role = keyof typeof ROLE_LEVELS;

declare module "fastify" {
  interface FastifyRequest {
    user: { id: number; username: string; displayName: string; role: Role } | null;
    setupMode: boolean;
  }
}

// Cache setup mode — once a user exists, skip the COUNT query on every request
let setupComplete = false;

/** Call after first user is created to skip future setup checks */
export function markSetupComplete() {
  setupComplete = true;
}

export async function authPlugin(app: FastifyInstance) {
  await app.register(fastifyCookie);

  app.decorateRequest("user", null);
  app.decorateRequest("setupMode", false);

  app.addHook("onRequest", async (request: FastifyRequest) => {
    // Check setup mode (0 users) — cached after first user exists
    if (!setupComplete) {
      const result = db.select({ total: count() }).from(schema.users).get();
      if (!result || result.total === 0) {
        request.setupMode = true;
        return;
      }
      setupComplete = true;
    }

    const token = request.cookies.bramble_session;
    if (!token) return;

    const now = new Date().toISOString();
    const session = db
      .select()
      .from(schema.sessions)
      .where(
        and(
          eq(schema.sessions.id, token),
          gt(schema.sessions.expiresAt, now),
        ),
      )
      .get();

    if (!session) return;

    const user = db
      .select({
        id: schema.users.id,
        username: schema.users.username,
        displayName: schema.users.displayName,
        role: schema.users.role,
      })
      .from(schema.users)
      .where(
        and(
          eq(schema.users.id, session.userId),
          eq(schema.users.isActive, true),
        ),
      )
      .get();

    if (user) {
      request.user = user as { id: number; username: string; displayName: string; role: Role };
    }
  });
}

/** Route-level guard: must be logged in */
export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  if (request.setupMode) {
    return reply.status(403).send({ error: "Setup required", setupMode: true });
  }
  if (!request.user) {
    return reply.status(401).send({ error: "Not authenticated" });
  }
}

/** Route-level guard: must have at least this role */
export function requireRole(minRole: Role) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    await requireAuth(request, reply);
    if (reply.sent) return;
    const userLevel = ROLE_LEVELS[request.user!.role];
    const requiredLevel = ROLE_LEVELS[minRole];
    if (userLevel < requiredLevel) {
      return reply.status(403).send({ error: "Insufficient permissions" });
    }
  };
}
