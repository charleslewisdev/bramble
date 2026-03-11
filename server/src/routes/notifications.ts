import { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { notificationChannels, notificationPreferences } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { sendNotification } from "../services/notifications.js";
import { getResolvedPreferences } from "../services/notification-preferences.js";
import { sendDigest } from "../services/scheduler.js";
import { z } from "zod";
import { idParamSchema } from "../lib/validation.js";

const channelTypeEnum = z.enum(["slack", "discord", "email", "pushover", "ntfy", "homeassistant"]);

const createChannelSchema = z.object({
  name: z.string().min(1),
  type: channelTypeEnum,
  config: z.record(z.string(), z.string()),
  enabled: z.boolean().optional(),
  quietHoursStart: z.string().optional(),
  quietHoursEnd: z.string().optional(),
});

const updateChannelSchema = z.object({
  name: z.string().min(1).optional(),
  type: channelTypeEnum.optional(),
  config: z.record(z.string(), z.string()).optional(),
  enabled: z.boolean().optional(),
  quietHoursStart: z.string().nullable().optional(),
  quietHoursEnd: z.string().nullable().optional(),
});

export async function notificationRoutes(app: FastifyInstance) {
  // GET / - list all channels
  app.get("/", async () => {
    return db.select().from(notificationChannels).all();
  });

  // POST / - create channel
  app.post("/", async (request, reply) => {
    const parsed = createChannelSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid request body" });
    }

    const result = db
      .insert(notificationChannels)
      .values(parsed.data)
      .returning()
      .get();

    return reply.status(201).send(result);
  });

  // PUT /:id - update channel
  app.put<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const paramsParsed = idParamSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      return reply.status(400).send({ error: "Invalid ID" });
    }
    const id = Number(request.params.id);

    const bodyParsed = updateChannelSchema.safeParse(request.body);
    if (!bodyParsed.success) {
      return reply.status(400).send({ error: bodyParsed.error.issues[0]?.message ?? "Invalid request body" });
    }

    const existing = await db.query.notificationChannels.findFirst({
      where: eq(notificationChannels.id, id),
    });

    if (!existing) {
      return reply.status(404).send({ error: "Notification channel not found" });
    }

    const result = db
      .update(notificationChannels)
      .set(bodyParsed.data)
      .where(eq(notificationChannels.id, id))
      .returning()
      .get();

    return result;
  });

  // DELETE /:id - delete channel
  app.delete<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const paramsParsed = idParamSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      return reply.status(400).send({ error: "Invalid ID" });
    }
    const id = Number(request.params.id);
    const existing = await db.query.notificationChannels.findFirst({
      where: eq(notificationChannels.id, id),
    });

    if (!existing) {
      return reply.status(404).send({ error: "Notification channel not found" });
    }

    db.delete(notificationChannels).where(eq(notificationChannels.id, id)).run();
    return reply.status(204).send();
  });

  // POST /:id/test - send test notification
  app.post<{ Params: { id: string } }>(
    "/:id/test",
    async (request, reply) => {
      const paramsParsed = idParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({ error: "Invalid ID" });
      }
      const id = Number(request.params.id);
      const existing = await db.query.notificationChannels.findFirst({
        where: eq(notificationChannels.id, id),
      });

      if (!existing) {
        return reply.status(404).send({ error: "Notification channel not found" });
      }

      const success = await sendNotification(
        existing,
        "Bramble Test Notification",
        "If you're reading this, your notification channel is working!",
      );

      return {
        success,
        message: success
          ? `Test notification sent via ${existing.type} to "${existing.name}"`
          : `Failed to send test notification via ${existing.type}`,
        channelId: id,
      };
    },
  );

  // ─── Notification Preference Routes ──────────────────────────────────────

  // GET /preferences - returns all notification preferences with defaults
  app.get("/preferences", async () => {
    return getResolvedPreferences();
  });

  // PUT /preferences/:taskType - update a preference
  app.put<{ Params: { taskType: string } }>(
    "/preferences/:taskType",
    async (request, reply) => {
      const taskTypes = [
        "water", "fertilize", "prune", "mulch", "harvest",
        "protect", "move", "repot", "inspect", "custom",
      ];
      const { taskType } = request.params;
      if (!taskTypes.includes(taskType)) {
        return reply.status(400).send({ error: `Invalid task type: ${taskType}` });
      }

      const updateSchema = z.object({
        enabled: z.boolean().optional(),
        frequency: z.enum(["immediate", "daily_digest", "weekly_digest"]).optional(),
        digestTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      });

      const parsed = updateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid request body" });
      }

      // Upsert: check if preference exists
      const typedTaskType = taskType as typeof notificationPreferences.$inferInsert.taskType;
      const existing = await db.query.notificationPreferences.findFirst({
        where: eq(notificationPreferences.taskType, typedTaskType),
      });

      if (existing) {
        const result = db
          .update(notificationPreferences)
          .set({
            ...parsed.data,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(notificationPreferences.taskType, typedTaskType))
          .returning()
          .get();
        return result;
      } else {
        const result = db
          .insert(notificationPreferences)
          .values({
            taskType: taskType as typeof notificationPreferences.$inferInsert.taskType,
            enabled: parsed.data.enabled ?? true,
            frequency: parsed.data.frequency ?? "daily_digest",
            digestTime: parsed.data.digestTime ?? "08:00",
          })
          .returning()
          .get();
        return reply.status(201).send(result);
      }
    },
  );

  // POST /send-digest - manual trigger for daily digest
  app.post("/send-digest", async (_request, reply) => {
    try {
      await sendDigest();
      return { success: true, message: "Digest sent (if there were tasks to notify about)." };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return reply.status(500).send({ error: `Failed to send digest: ${message}` });
    }
  });
}
