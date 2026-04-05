import { FastifyInstance } from "fastify";
import { z } from "zod";
import { db, schema } from "../db/index.js";
import { eq, and, gt, isNull } from "drizzle-orm";
import {
  hashPassword,
  generateInviteToken,
  generateSessionToken,
  INVITE_MAX_AGE_MS,
  SESSION_MAX_AGE_MS,
} from "../services/auth.js";
import { requireRole } from "../plugins/auth.js";
import { idParamSchema } from "../lib/validation.js";

const SESSION_COOKIE = "bramble_session";

function cookieOptions() {
  const secure = process.env.COOKIE_SECURE === "true";
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
    maxAge: Math.floor(SESSION_MAX_AGE_MS / 1000),
  };
}

const createInviteSchema = z.object({
  role: z.enum(["gardener", "helper"]),
  expiresInDays: z.number().int().positive().max(30).optional(),
});

const claimSchema = z.object({
  username: z.string().min(2).max(50).regex(/^[a-zA-Z0-9_-]+$/, "Username must be alphanumeric, hyphens, or underscores"),
  displayName: z.string().min(1).max(100),
  password: z.string().min(8).max(128),
});

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

export async function inviteRoutes(app: FastifyInstance) {
  // POST / — Groundskeeper creates invite
  app.post("/", { preHandler: requireRole("groundskeeper") }, async (request, reply) => {
    const body = createInviteSchema.parse(request.body);
    const token = generateInviteToken();
    const expiresMs = (body.expiresInDays ?? 7) * 24 * 60 * 60 * 1000;
    const expiresAt = new Date(Date.now() + expiresMs).toISOString();

    const invite = db.insert(schema.invites).values({
      token,
      role: body.role,
      createdBy: request.user!.id,
      expiresAt,
    }).returning().get();

    return reply.status(201).send(invite);
  });

  // GET / — Groundskeeper lists all invites
  app.get("/", { preHandler: requireRole("groundskeeper") }, async () => {
    return db.select().from(schema.invites).all();
  });

  // DELETE /:id — Groundskeeper revokes invite
  app.delete("/:id", { preHandler: requireRole("groundskeeper") }, async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    const result = db.delete(schema.invites).where(eq(schema.invites.id, Number(id))).run();
    if (result.changes === 0) {
      return reply.status(404).send({ error: "Invite not found" });
    }
    return reply.status(204).send();
  });

  // GET /:token — Public: check invite validity
  app.get("/:token", async (request, reply) => {
    const { token } = request.params as { token: string };
    const now = new Date().toISOString();

    const invite = db.select().from(schema.invites)
      .where(
        and(
          eq(schema.invites.token, token),
          gt(schema.invites.expiresAt, now),
          isNull(schema.invites.claimedBy),
        ),
      )
      .get();

    if (!invite) {
      return reply.status(404).send({ error: "Invite not found or expired" });
    }

    return { role: invite.role, expiresAt: invite.expiresAt };
  });

  // POST /:token/claim — Public: claim invite and create account
  app.post("/:token/claim", async (request, reply) => {
    const { token } = request.params as { token: string };
    const now = new Date().toISOString();

    const invite = db.select().from(schema.invites)
      .where(
        and(
          eq(schema.invites.token, token),
          gt(schema.invites.expiresAt, now),
          isNull(schema.invites.claimedBy),
        ),
      )
      .get();

    if (!invite) {
      return reply.status(404).send({ error: "Invite not found or expired" });
    }

    const body = claimSchema.parse(request.body);

    // Check username uniqueness
    const existing = db.select({ id: schema.users.id }).from(schema.users)
      .where(eq(schema.users.username, body.username))
      .get();

    if (existing) {
      return reply.status(409).send({ error: "Username already taken" });
    }

    const passwordHash = await hashPassword(body.password);

    const user = db.insert(schema.users).values({
      username: body.username,
      displayName: body.displayName,
      passwordHash,
      role: invite.role,
    }).returning().get();

    // Mark invite as claimed
    db.update(schema.invites)
      .set({ claimedBy: user.id })
      .where(eq(schema.invites.id, invite.id))
      .run();

    // Create session
    const sessionToken = generateSessionToken();
    const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_MS).toISOString();
    db.insert(schema.sessions).values({
      id: sessionToken,
      userId: user.id,
      expiresAt,
      userAgent: request.headers["user-agent"] ?? null,
    }).run();

    reply.setCookie(SESSION_COOKIE, sessionToken, cookieOptions());
    return reply.status(201).send(userResponse(user));
  });
}
