import { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { careTasks, careTaskLogs, plantInstances } from "../db/schema.js";
import { eq, and, sql, inArray } from "drizzle-orm";
import { z } from "zod";
import { generateDefaultCareTasks } from "../services/care-tasks.js";
import { idParamSchema } from "../lib/validation.js";

const taskTypeEnum = z.enum([
  "water", "fertilize", "prune", "mulch", "harvest",
  "protect", "move", "repot", "inspect", "custom",
]);
const actionEnum = z.enum(["completed", "skipped", "deferred"]);

const createTaskSchema = z.object({
  plantInstanceId: z.number().int().positive().optional(),
  zoneId: z.number().int().positive().optional(),
  locationId: z.number().int().positive().optional(),
  taskType: taskTypeEnum,
  title: z.string().min(1),
  description: z.string().optional(),
  dueDate: z.string().optional(),
  isRecurring: z.boolean().optional(),
  intervalDays: z.number().int().positive().optional(),
  activeMonths: z.array(z.number().int().min(1).max(12)).optional(),
  sendNotification: z.boolean().optional(),
  plantMessage: z.string().optional(),
});

const updateTaskSchema = createTaskSchema.partial();

const logActionSchema = z.object({
  action: actionEnum,
  notes: z.string().optional(),
  photoId: z.number().int().positive().optional(),
});

export async function careTaskRoutes(app: FastifyInstance) {
  // GET / - list care tasks with filters
  app.get<{
    Querystring: {
      plantInstanceId?: string;
      zoneId?: string;
      locationId?: string;
      upcoming?: string;
    };
  }>("/", async (request) => {
    const { plantInstanceId, zoneId, locationId, upcoming } = request.query;

    const conditions = [];

    if (plantInstanceId) {
      const num = Number(plantInstanceId);
      if (!isNaN(num)) conditions.push(eq(careTasks.plantInstanceId, num));
    }
    if (zoneId) {
      const num = Number(zoneId);
      if (!isNaN(num)) conditions.push(eq(careTasks.zoneId, num));
    }
    if (locationId) {
      const num = Number(locationId);
      if (!isNaN(num)) conditions.push(eq(careTasks.locationId, num));
    }
    if (upcoming === "true") {
      conditions.push(
        sql`${careTasks.dueDate} >= date('now')`,
      );
    }

    if (conditions.length > 0) {
      return db
        .select()
        .from(careTasks)
        .where(and(...conditions))
        .all();
    }

    return db.select().from(careTasks).all();
  });

  // GET /:id - get task with completion logs
  app.get<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const paramsParsed = idParamSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      return reply.status(400).send({ error: "Invalid ID" });
    }
    const id = Number(request.params.id);
    const task = await db.query.careTasks.findFirst({
      where: eq(careTasks.id, id),
      with: {
        logs: true,
        plantInstance: {
          with: { plantReference: true },
        },
        zone: true,
      },
    });

    if (!task) {
      return reply.status(404).send({ error: "Care task not found" });
    }

    return task;
  });

  // POST / - create task
  app.post("/", async (request, reply) => {
    const parsed = createTaskSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid request body" });
    }

    const result = db
      .insert(careTasks)
      .values(parsed.data as typeof careTasks.$inferInsert)
      .returning()
      .get();

    return reply.status(201).send(result);
  });

  // PUT /:id - update task
  app.put<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const paramsParsed = idParamSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      return reply.status(400).send({ error: "Invalid ID" });
    }
    const id = Number(request.params.id);

    const bodyParsed = updateTaskSchema.safeParse(request.body);
    if (!bodyParsed.success) {
      return reply.status(400).send({ error: bodyParsed.error.issues[0]?.message ?? "Invalid request body" });
    }

    const existing = await db.query.careTasks.findFirst({
      where: eq(careTasks.id, id),
    });

    if (!existing) {
      return reply.status(404).send({ error: "Care task not found" });
    }

    const result = db
      .update(careTasks)
      .set({
        ...(bodyParsed.data as Partial<typeof careTasks.$inferInsert>),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(careTasks.id, id))
      .returning()
      .get();

    return result;
  });

  // DELETE /:id - delete task
  app.delete<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const paramsParsed = idParamSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      return reply.status(400).send({ error: "Invalid ID" });
    }
    const id = Number(request.params.id);
    const existing = await db.query.careTasks.findFirst({
      where: eq(careTasks.id, id),
    });

    if (!existing) {
      return reply.status(404).send({ error: "Care task not found" });
    }

    db.delete(careTasks).where(eq(careTasks.id, id)).run();
    return reply.status(204).send();
  });

  // POST /:id/log - log a completion
  app.post<{ Params: { id: string } }>("/:id/log", async (request, reply) => {
    const paramsParsed = idParamSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      return reply.status(400).send({ error: "Invalid ID" });
    }
    const careTaskId = Number(request.params.id);

    const bodyParsed = logActionSchema.safeParse(request.body);
    if (!bodyParsed.success) {
      return reply.status(400).send({ error: bodyParsed.error.issues[0]?.message ?? "Invalid request body" });
    }

    const existing = await db.query.careTasks.findFirst({
      where: eq(careTasks.id, careTaskId),
    });

    if (!existing) {
      return reply.status(404).send({ error: "Care task not found" });
    }

    const log = db
      .insert(careTaskLogs)
      .values({
        careTaskId,
        action: bodyParsed.data.action,
        notes: bodyParsed.data.notes,
        photoId: bodyParsed.data.photoId,
      })
      .returning()
      .get();

    // If recurring and completed, advance the due date
    if (
      bodyParsed.data.action === "completed" &&
      existing.isRecurring &&
      existing.intervalDays &&
      existing.dueDate
    ) {
      // Advance from today if overdue, otherwise from the original due date
      const baseDate = new Date(existing.dueDate) < new Date() ? new Date() : new Date(existing.dueDate);
      const nextDue = new Date(baseDate);
      nextDue.setDate(nextDue.getDate() + existing.intervalDays);
      db.update(careTasks)
        .set({
          dueDate: nextDue.toISOString().split("T")[0],
          updatedAt: new Date().toISOString(),
        })
        .where(eq(careTasks.id, careTaskId))
        .run();
    }

    return reply.status(201).send(log);
  });

  // POST /bulk/log - bulk complete or skip tasks
  const bulkLogSchema = z.object({
    ids: z.array(z.number().int().positive()).min(1),
    action: z.enum(["completed", "skipped"]),
  });

  app.post("/bulk/log", async (request, reply) => {
    const parsed = bulkLogSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid request body" });
    }

    const { ids, action } = parsed.data;

    // Fetch all matching tasks
    const tasks = await db
      .select()
      .from(careTasks)
      .where(inArray(careTasks.id, ids))
      .all();

    if (tasks.length === 0) {
      return reply.status(404).send({ error: "No matching care tasks found" });
    }

    // Insert log entries and advance recurring tasks in a transaction
    db.transaction((tx) => {
      for (const task of tasks) {
        tx.insert(careTaskLogs)
          .values({
            careTaskId: task.id,
            action,
          })
          .run();

        // If recurring and completed, advance the due date
        if (
          action === "completed" &&
          task.isRecurring &&
          task.intervalDays &&
          task.dueDate
        ) {
          const baseDate = new Date(task.dueDate) < new Date() ? new Date() : new Date(task.dueDate);
          const nextDue = new Date(baseDate);
          nextDue.setDate(nextDue.getDate() + task.intervalDays);
          tx.update(careTasks)
            .set({
              dueDate: nextDue.toISOString().split("T")[0],
              updatedAt: new Date().toISOString(),
            })
            .where(eq(careTasks.id, task.id))
            .run();
        }
      }
    });

    return { count: tasks.length };
  });

  // DELETE /bulk - bulk delete tasks
  const bulkDeleteSchema = z.object({
    ids: z.array(z.number().int().positive()).min(1),
  });

  app.delete("/bulk", async (request, reply) => {
    const parsed = bulkDeleteSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid request body" });
    }

    const { ids } = parsed.data;

    const result = db
      .delete(careTasks)
      .where(inArray(careTasks.id, ids))
      .run();

    return { count: result.changes };
  });

  // POST /generate/:plantInstanceId - generate default care tasks for a plant
  app.post<{ Params: { plantInstanceId: string } }>(
    "/generate/:plantInstanceId",
    async (request, reply) => {
      const plantInstanceId = Number(request.params.plantInstanceId);
      if (isNaN(plantInstanceId) || plantInstanceId <= 0) {
        return reply.status(400).send({ error: "Invalid plant instance ID" });
      }

      // Fetch plant instance with reference and zone
      const instance = await db.query.plantInstances.findFirst({
        where: eq(plantInstances.id, plantInstanceId),
        with: {
          plantReference: true,
          zone: true,
        },
      });

      if (!instance) {
        return reply.status(404).send({ error: "Plant instance not found" });
      }

      // Get existing task types for dedup
      const existingTasks = await db
        .select({ taskType: careTasks.taskType })
        .from(careTasks)
        .where(eq(careTasks.plantInstanceId, plantInstanceId))
        .all();

      const existingTaskTypes = existingTasks.map((t) => t.taskType);

      // Generate tasks
      const newTasks = generateDefaultCareTasks(instance, instance.plantReference, {
        existingTaskTypes,
        zone: instance.zone,
      });

      if (newTasks.length === 0) {
        return reply.status(200).send({ generated: [], message: "No new tasks to generate." });
      }

      // Insert all generated tasks
      const inserted = [];
      for (const task of newTasks) {
        const result = db
          .insert(careTasks)
          .values(task)
          .returning()
          .get();
        inserted.push(result);
      }

      return reply.status(201).send({ generated: inserted });
    },
  );
}
