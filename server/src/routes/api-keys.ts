import { FastifyInstance } from "fastify";
import { z } from "zod";
import { db, schema } from "../db/index.js";
import { eq, and } from "drizzle-orm";
import { generateApiKey, hashApiKey, apiKeyPrefix } from "../services/auth.js";
import { requireRole } from "../plugins/auth.js";
import { idParamSchema } from "../lib/validation.js";

const createKeySchema = z.object({
  name: z.string().min(1).max(100),
});

export async function apiKeyRoutes(app: FastifyInstance) {
  // All routes require Groundskeeper
  app.addHook("onRequest", requireRole("groundskeeper"));

  // GET / — list all API keys (never returns the actual key)
  app.get("/", async () => {
    return db.select({
      id: schema.apiKeys.id,
      name: schema.apiKeys.name,
      keyPrefix: schema.apiKeys.keyPrefix,
      userId: schema.apiKeys.userId,
      lastUsedAt: schema.apiKeys.lastUsedAt,
      createdAt: schema.apiKeys.createdAt,
    }).from(schema.apiKeys).all();
  });

  // POST / — create a new API key (returns the raw key ONCE)
  app.post("/", async (request, reply) => {
    const body = createKeySchema.parse(request.body);
    const rawKey = generateApiKey();
    const keyHash = hashApiKey(rawKey);
    const prefix = apiKeyPrefix(rawKey);

    const apiKey = db.insert(schema.apiKeys).values({
      name: body.name,
      keyHash,
      keyPrefix: prefix,
      userId: request.user!.id,
    }).returning().get();

    // Return the raw key — this is the ONLY time it's visible
    return reply.status(201).send({
      id: apiKey.id,
      name: apiKey.name,
      key: rawKey,
      keyPrefix: prefix,
      createdAt: apiKey.createdAt,
    });
  });

  // POST /:id/regenerate — regenerate an existing API key (own keys only)
  app.post("/:id/regenerate", async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    const keyId = Number(id);

    const existing = db.select().from(schema.apiKeys)
      .where(and(eq(schema.apiKeys.id, keyId), eq(schema.apiKeys.userId, request.user!.id)))
      .get();

    if (!existing) {
      return reply.status(404).send({ error: "API key not found" });
    }

    const rawKey = generateApiKey();
    const keyHash = hashApiKey(rawKey);
    const prefix = apiKeyPrefix(rawKey);

    db.update(schema.apiKeys).set({
      keyHash,
      keyPrefix: prefix,
      lastUsedAt: null,
    }).where(eq(schema.apiKeys.id, keyId)).run();

    return reply.status(200).send({
      id: keyId,
      name: existing.name,
      key: rawKey,
      keyPrefix: prefix,
      createdAt: existing.createdAt,
    });
  });

  // DELETE /:id — revoke an API key (own keys only)
  app.delete("/:id", async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    const result = db.delete(schema.apiKeys)
      .where(and(eq(schema.apiKeys.id, Number(id)), eq(schema.apiKeys.userId, request.user!.id)))
      .run();

    if (result.changes === 0) {
      return reply.status(404).send({ error: "API key not found" });
    }
    return reply.status(204).send();
  });
}
