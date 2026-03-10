import { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { settings } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { z } from "zod";

const keyParamSchema = z.object({
  key: z.string().min(1),
});

const setValueSchema = z.object({
  value: z.unknown(),
});

export async function settingsRoutes(app: FastifyInstance) {
  // GET / - list all settings
  app.get("/", async () => {
    const rows = db.select().from(settings).all();
    // Return as key-value object for convenience
    const result: Record<string, unknown> = {};
    for (const row of rows) {
      result[row.key] = row.value;
    }
    return result;
  });

  // PUT /:key - set a setting value
  app.put<{
    Params: { key: string };
    Body: { value: unknown };
  }>("/:key", async (request, reply) => {
    const paramsParsed = keyParamSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      return reply.status(400).send({ error: "Invalid key" });
    }
    const bodyParsed = setValueSchema.safeParse(request.body);
    if (!bodyParsed.success) {
      return reply.status(400).send({ error: "Invalid request body" });
    }
    const { key } = paramsParsed.data;
    const { value } = bodyParsed.data;

    const result = db
      .insert(settings)
      .values({
        key,
        value: value as Record<string, unknown>,
        updatedAt: new Date().toISOString(),
      })
      .onConflictDoUpdate({
        target: settings.key,
        set: {
          value: value as Record<string, unknown>,
          updatedAt: new Date().toISOString(),
        },
      })
      .returning()
      .get();

    return result;
  });
}
