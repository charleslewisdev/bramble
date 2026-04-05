import { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { shoppingListItems } from "../db/schema.js";
import { eq, asc, desc, count } from "drizzle-orm";
import { z } from "zod";
import { idParamSchema, parsePagination, paginatedResult } from "../lib/validation.js";
import { requireAuth, requireRole } from "../plugins/auth.js";

const categoryEnum = z.enum(["plant", "soil", "fertilizer", "tool", "container", "other"]);

const createItemSchema = z.object({
  name: z.string().min(1),
  quantity: z.number().int().positive().optional(),
  notes: z.string().optional(),
  plantReferenceId: z.number().int().positive().optional(),
  category: categoryEnum.optional(),
  estimatedCost: z.number().positive().optional(),
  vendorName: z.string().optional(),
  purchasedAt: z.string().optional(),
});

const updateItemSchema = z.object({
  name: z.string().min(1).optional(),
  quantity: z.number().int().positive().optional(),
  isChecked: z.boolean().optional(),
  notes: z.string().optional(),
  plantReferenceId: z.number().int().positive().optional(),
  category: categoryEnum.nullable().optional(),
  estimatedCost: z.number().positive().nullable().optional(),
  vendorName: z.string().nullable().optional(),
  purchasedAt: z.string().nullable().optional(),
});

export async function shoppingListRoutes(app: FastifyInstance) {
  // Auth: require login for all routes in this plugin
  app.addHook("onRequest", requireAuth);

  // GET / - list all items (unchecked first, then checked; supports ?page=&limit= pagination)
  app.get<{ Querystring: { page?: string; limit?: string } }>("/", async (request) => {
    const pagination = parsePagination(request.query);

    if (pagination) {
      const [{ total }] = db
        .select({ total: count() })
        .from(shoppingListItems)
        .all() as [{ total: number }];

      const data = db
        .select()
        .from(shoppingListItems)
        .orderBy(asc(shoppingListItems.isChecked), desc(shoppingListItems.createdAt))
        .limit(pagination.limit)
        .offset(pagination.offset)
        .all();

      return paginatedResult(data, total, pagination.page, pagination.limit);
    }

    return db
      .select()
      .from(shoppingListItems)
      .orderBy(asc(shoppingListItems.isChecked), desc(shoppingListItems.createdAt))
      .all();
  });

  // POST / - create item
  app.post("/", async (request, reply) => {
    const parsed = createItemSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid request body" });
    }

    const result = db
      .insert(shoppingListItems)
      .values({ ...parsed.data, createdBy: request.user?.id ?? null })
      .returning()
      .get();

    return reply.status(201).send(result);
  });

  // PUT /:id - update item
  app.put<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const paramsParsed = idParamSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      return reply.status(400).send({ error: "Invalid ID" });
    }
    const id = Number(request.params.id);

    const bodyParsed = updateItemSchema.safeParse(request.body);
    if (!bodyParsed.success) {
      return reply.status(400).send({ error: bodyParsed.error.issues[0]?.message ?? "Invalid request body" });
    }

    const existing = await db.query.shoppingListItems.findFirst({
      where: eq(shoppingListItems.id, id),
    });

    if (!existing) {
      return reply.status(404).send({ error: "Shopping list item not found" });
    }

    const result = db
      .update(shoppingListItems)
      .set(bodyParsed.data)
      .where(eq(shoppingListItems.id, id))
      .returning()
      .get();

    return result;
  });

  // PATCH /:id/toggle - toggle checked status
  app.patch<{ Params: { id: string } }>(
    "/:id/toggle",
    async (request, reply) => {
      const paramsParsed = idParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({ error: "Invalid ID" });
      }
      const id = Number(request.params.id);
      const existing = await db.query.shoppingListItems.findFirst({
        where: eq(shoppingListItems.id, id),
      });

      if (!existing) {
        return reply
          .status(404)
          .send({ error: "Shopping list item not found" });
      }

      const result = db
        .update(shoppingListItems)
        .set({ isChecked: !existing.isChecked })
        .where(eq(shoppingListItems.id, id))
        .returning()
        .get();

      return result;
    },
  );

  // DELETE /clear-checked - clear all checked items
  // IMPORTANT: Must be registered BEFORE DELETE /:id to avoid route conflict
  app.delete("/clear-checked", { preHandler: requireRole("gardener") }, async (_request, reply) => {
    db.delete(shoppingListItems)
      .where(eq(shoppingListItems.isChecked, true))
      .run();
    return reply.status(204).send();
  });

  // DELETE /:id - delete item
  app.delete<{ Params: { id: string } }>("/:id", { preHandler: requireRole("gardener") }, async (request, reply) => {
    const paramsParsed = idParamSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      return reply.status(400).send({ error: "Invalid ID" });
    }
    const id = Number(request.params.id);
    const existing = await db.query.shoppingListItems.findFirst({
      where: eq(shoppingListItems.id, id),
    });

    if (!existing) {
      return reply.status(404).send({ error: "Shopping list item not found" });
    }

    db.delete(shoppingListItems).where(eq(shoppingListItems.id, id)).run();
    return reply.status(204).send();
  });
}
