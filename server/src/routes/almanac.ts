import { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import {
  almanacEntries,
  almanacEntryTags,
  almanacImages,
  almanacTags,
} from "../db/schema.js";
import { desc, eq, inArray, notInArray, sql } from "drizzle-orm";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import { z } from "zod";
import { idParamSchema } from "../lib/validation.js";
import { slugify, uniqueSlug } from "../lib/slug.js";
import { requireAuth, requireRole } from "../plugins/auth.js";

const __almanac_dirname = dirname(fileURLToPath(import.meta.url));
const ALMANAC_IMAGES_DIR =
  process.env.ALMANAC_IMAGES_DIR ??
  resolve(__almanac_dirname, "../../data/almanac-images");

function ensureImagesDir() {
  if (!existsSync(ALMANAC_IMAGES_DIR)) {
    mkdirSync(ALMANAC_IMAGES_DIR, { recursive: true });
  }
}

function getContentType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    case "svg":
      return "image/svg+xml";
    default:
      return "application/octet-stream";
  }
}

function isValidFilename(filename: string): boolean {
  return (
    !!filename &&
    !filename.includes("..") &&
    !filename.includes("/") &&
    !filename.includes("\\")
  );
}

// ─── Validation ─────────────────────────────────────────────────────────────

const tagsSchema = z
  .array(z.string().min(1).max(48).trim())
  .max(20)
  .transform((arr) =>
    Array.from(new Set(arr.map((t) => t.toLowerCase().trim()).filter(Boolean))),
  );

const createEntrySchema = z.object({
  title: z.string().min(1).max(200).optional(),
  excerpt: z.string().max(500).nullable().optional(),
  content: z.string().optional(),
  tags: tagsSchema.optional(),
});

const updateEntrySchema = z.object({
  title: z.string().min(1).max(200).optional(),
  excerpt: z.string().max(500).nullable().optional(),
  content: z.string().optional(),
  tags: tagsSchema.optional(),
});

const slugParamSchema = z.object({
  slug: z.string().min(1).max(220),
});

const filenameParamSchema = z.object({
  filename: z.string().min(1).refine(isValidFilename, { message: "Invalid filename" }),
});

const uploadImageSchema = z.object({
  imageData: z.string().min(1),
});

// ─── Helpers ────────────────────────────────────────────────────────────────

type EntryRow = typeof almanacEntries.$inferSelect;
type EntryResponse = EntryRow & { tags: string[] };

function slugExists(candidate: string): boolean {
  const row = db
    .select({ id: almanacEntries.id })
    .from(almanacEntries)
    .where(eq(almanacEntries.slug, candidate))
    .get();
  return !!row;
}

/** Ensure each tag name has a row, return the set of tag IDs. */
function upsertTags(names: string[]): number[] {
  if (names.length === 0) return [];
  const ids: number[] = [];
  for (const name of names) {
    const existing = db
      .select({ id: almanacTags.id })
      .from(almanacTags)
      .where(eq(almanacTags.name, name))
      .get();
    if (existing) {
      ids.push(existing.id);
    } else {
      const inserted = db
        .insert(almanacTags)
        .values({ name })
        .returning({ id: almanacTags.id })
        .get();
      ids.push(inserted.id);
    }
  }
  return ids;
}

/** Remove tag rows that are no longer referenced by any entry. */
function pruneOrphanTags(): void {
  db.delete(almanacTags)
    .where(
      notInArray(
        almanacTags.id,
        db.select({ id: almanacEntryTags.tagId }).from(almanacEntryTags),
      ),
    )
    .run();
}

/** Load tag names for a set of entry IDs, grouped by entryId. */
function tagsByEntry(entryIds: number[]): Map<number, string[]> {
  const map = new Map<number, string[]>();
  if (entryIds.length === 0) return map;
  const rows = db
    .select({
      entryId: almanacEntryTags.entryId,
      name: almanacTags.name,
    })
    .from(almanacEntryTags)
    .innerJoin(almanacTags, eq(almanacTags.id, almanacEntryTags.tagId))
    .where(inArray(almanacEntryTags.entryId, entryIds))
    .all();
  for (const r of rows) {
    const list = map.get(r.entryId) ?? [];
    list.push(r.name);
    map.set(r.entryId, list);
  }
  for (const list of map.values()) list.sort();
  return map;
}

function entryWithTags(entry: EntryRow, tags: string[] = []): EntryResponse {
  return { ...entry, tags };
}

function allTagCounts(): { name: string; count: number }[] {
  const rows = db
    .select({
      name: almanacTags.name,
      count: sql<number>`count(${almanacEntryTags.entryId})`,
    })
    .from(almanacTags)
    .leftJoin(almanacEntryTags, eq(almanacEntryTags.tagId, almanacTags.id))
    .groupBy(almanacTags.id, almanacTags.name)
    .orderBy(almanacTags.name)
    .all();
  return rows.map((r) => ({ name: r.name, count: Number(r.count) }));
}

// ─── Routes ─────────────────────────────────────────────────────────────────

export async function almanacRoutes(app: FastifyInstance) {
  app.addHook("onRequest", requireAuth);

  // GET / — list entries (+ tag counts); optional ?tag=<name> filter
  app.get<{ Querystring: { tag?: string } }>("/", async (request) => {
    const tagFilter = request.query.tag?.toLowerCase().trim();

    let entryRows: EntryRow[];
    if (tagFilter) {
      entryRows = db
        .select({
          id: almanacEntries.id,
          slug: almanacEntries.slug,
          title: almanacEntries.title,
          excerpt: almanacEntries.excerpt,
          content: almanacEntries.content,
          createdBy: almanacEntries.createdBy,
          createdAt: almanacEntries.createdAt,
          updatedAt: almanacEntries.updatedAt,
        })
        .from(almanacEntries)
        .innerJoin(almanacEntryTags, eq(almanacEntryTags.entryId, almanacEntries.id))
        .innerJoin(almanacTags, eq(almanacTags.id, almanacEntryTags.tagId))
        .where(eq(almanacTags.name, tagFilter))
        .orderBy(desc(almanacEntries.updatedAt))
        .all();
    } else {
      entryRows = db
        .select()
        .from(almanacEntries)
        .orderBy(desc(almanacEntries.updatedAt))
        .all();
    }

    const tagMap = tagsByEntry(entryRows.map((e) => e.id));
    const entries = entryRows.map((e) => entryWithTags(e, tagMap.get(e.id) ?? []));

    return {
      entries,
      tags: allTagCounts(),
    };
  });

  // GET /tags — list tags with counts
  app.get("/tags", async () => ({ tags: allTagCounts() }));

  // GET /images/:filename — serve image bytes
  app.get<{ Params: { filename: string } }>("/images/:filename", async (request, reply) => {
    const parsed = filenameParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid filename" });
    }
    const { filename } = parsed.data;
    const canonicalDir = resolve(ALMANAC_IMAGES_DIR);
    const filepath = resolve(ALMANAC_IMAGES_DIR, filename);
    if (!filepath.startsWith(canonicalDir + "/") && filepath !== canonicalDir) {
      return reply.status(400).send({ error: "Invalid filename" });
    }
    if (!existsSync(filepath)) {
      return reply.status(404).send({ error: "Image not found" });
    }
    const buffer = readFileSync(filepath);
    return reply.type(getContentType(filename)).send(buffer);
  });

  // GET /:slug — single entry by slug
  app.get<{ Params: { slug: string } }>("/:slug", async (request, reply) => {
    const parsed = slugParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid slug" });
    }
    const entry = db
      .select()
      .from(almanacEntries)
      .where(eq(almanacEntries.slug, parsed.data.slug))
      .get();
    if (!entry) return reply.status(404).send({ error: "Entry not found" });

    const tagMap = tagsByEntry([entry.id]);
    const images = db
      .select()
      .from(almanacImages)
      .where(eq(almanacImages.entryId, entry.id))
      .all();

    return { ...entryWithTags(entry, tagMap.get(entry.id) ?? []), images };
  });

  // POST / — create entry (stub-on-open friendly; title defaults to "Untitled")
  app.post("/", async (request, reply) => {
    const parsed = createEntrySchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply
        .status(400)
        .send({ error: parsed.error.issues[0]?.message ?? "Invalid request body" });
    }
    const { title = "Untitled", excerpt, content, tags = [] } = parsed.data;
    const slug = uniqueSlug(slugify(title), slugExists);

    const entry = db.transaction((tx) => {
      const created = tx
        .insert(almanacEntries)
        .values({
          slug,
          title,
          excerpt: excerpt ?? null,
          content: content ?? "",
          createdBy: request.user?.id ?? null,
        })
        .returning()
        .get();

      if (tags.length > 0) {
        const tagIds = upsertTags(tags);
        for (const tagId of tagIds) {
          tx.insert(almanacEntryTags)
            .values({ entryId: created.id, tagId })
            .run();
        }
      }
      return created;
    });

    return reply.status(201).send(entryWithTags(entry, tags));
  });

  // PATCH /:id — update fields and/or tag set (slug is immutable)
  app.patch<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const paramsParsed = idParamSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      return reply.status(400).send({ error: "Invalid ID" });
    }
    const id = Number(request.params.id);

    const bodyParsed = updateEntrySchema.safeParse(request.body ?? {});
    if (!bodyParsed.success) {
      return reply
        .status(400)
        .send({ error: bodyParsed.error.issues[0]?.message ?? "Invalid request body" });
    }

    const existing = db
      .select()
      .from(almanacEntries)
      .where(eq(almanacEntries.id, id))
      .get();
    if (!existing) return reply.status(404).send({ error: "Entry not found" });

    const { title, excerpt, content, tags } = bodyParsed.data;

    const updated = db.transaction((tx) => {
      const patch: Partial<typeof almanacEntries.$inferInsert> = {
        updatedAt: new Date().toISOString(),
      };
      if (title !== undefined) patch.title = title;
      if (excerpt !== undefined) patch.excerpt = excerpt;
      if (content !== undefined) patch.content = content;

      // If this is still a stub (slug matches "untitled" or "untitled-N") and the
      // user is giving it a real title, regenerate the slug from the new title.
      const isStubSlug = /^untitled(-\d+)?$/.test(existing.slug);
      if (title !== undefined && isStubSlug && title !== "Untitled") {
        patch.slug = uniqueSlug(slugify(title), (candidate) =>
          candidate === existing.slug ? false : slugExists(candidate),
        );
      }

      const row = tx
        .update(almanacEntries)
        .set(patch)
        .where(eq(almanacEntries.id, id))
        .returning()
        .get();

      if (tags !== undefined) {
        tx.delete(almanacEntryTags)
          .where(eq(almanacEntryTags.entryId, id))
          .run();
        if (tags.length > 0) {
          const tagIds = upsertTags(tags);
          for (const tagId of tagIds) {
            tx.insert(almanacEntryTags)
              .values({ entryId: id, tagId })
              .run();
          }
        }
      }
      return row;
    });

    if (tags !== undefined) pruneOrphanTags();

    const tagMap = tagsByEntry([id]);
    return entryWithTags(updated, tagMap.get(id) ?? []);
  });

  // DELETE /:id — delete entry (cascades to tag links + images)
  app.delete<{ Params: { id: string } }>(
    "/:id",
    { preHandler: requireRole("gardener") },
    async (request, reply) => {
      const paramsParsed = idParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({ error: "Invalid ID" });
      }
      const id = Number(request.params.id);

      const existing = db
        .select({ id: almanacEntries.id })
        .from(almanacEntries)
        .where(eq(almanacEntries.id, id))
        .get();
      if (!existing) return reply.status(404).send({ error: "Entry not found" });

      // Collect image filenames first so we can remove files after the row is gone
      const imageRows = db
        .select({ filename: almanacImages.filename })
        .from(almanacImages)
        .where(eq(almanacImages.entryId, id))
        .all();

      db.delete(almanacEntries).where(eq(almanacEntries.id, id)).run();
      pruneOrphanTags();

      const canonicalDir = resolve(ALMANAC_IMAGES_DIR);
      for (const img of imageRows) {
        const fp = resolve(ALMANAC_IMAGES_DIR, img.filename);
        if (fp.startsWith(canonicalDir + "/") && existsSync(fp)) {
          try {
            unlinkSync(fp);
          } catch (err) {
            request.log.warn({ err, filename: img.filename }, "Failed to unlink almanac image");
          }
        }
      }

      return reply.status(204).send();
    },
  );

  // POST /:id/images — upload image (base64), returns { id, filename, url }
  app.post<{ Params: { id: string } }>(
    "/:id/images",
    { bodyLimit: 10 * 1024 * 1024 },
    async (request, reply) => {
      const paramsParsed = idParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({ error: "Invalid ID" });
      }
      const id = Number(request.params.id);

      const entry = db
        .select({ id: almanacEntries.id })
        .from(almanacEntries)
        .where(eq(almanacEntries.id, id))
        .get();
      if (!entry) return reply.status(404).send({ error: "Entry not found" });

      const bodyParsed = uploadImageSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.status(400).send({ error: "imageData is required" });
      }
      const { imageData } = bodyParsed.data;

      let extension = "jpg";
      let mimeType = "image/jpeg";
      let rawBase64 = imageData;
      if (imageData.startsWith("data:")) {
        const match = imageData.match(/^data:(image\/([\w+]+));base64,/);
        if (match) {
          mimeType = match[1]!;
          const sub = match[2]!.toLowerCase();
          extension = sub === "jpeg" ? "jpg" : sub === "svg+xml" ? "svg" : sub;
          rawBase64 = imageData.replace(/^data:image\/[\w+]+;base64,/, "");
        }
      }
      const buffer = Buffer.from(rawBase64, "base64");
      const filename = `${randomUUID()}.${extension}`;

      ensureImagesDir();
      writeFileSync(resolve(ALMANAC_IMAGES_DIR, filename), buffer);

      const row = db
        .insert(almanacImages)
        .values({
          entryId: id,
          filename,
          mimeType,
          size: buffer.byteLength,
        })
        .returning()
        .get();

      return reply.status(201).send({
        ...row,
        url: `/api/almanac/images/${filename}`,
      });
    },
  );

  // DELETE /images/:id — delete image row + file
  app.delete<{ Params: { id: string } }>(
    "/images/:id",
    { preHandler: requireRole("gardener") },
    async (request, reply) => {
      const paramsParsed = idParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({ error: "Invalid ID" });
      }
      const id = Number(request.params.id);
      const img = db
        .select()
        .from(almanacImages)
        .where(eq(almanacImages.id, id))
        .get();
      if (!img) return reply.status(404).send({ error: "Image not found" });

      const canonicalDir = resolve(ALMANAC_IMAGES_DIR);
      const fp = resolve(ALMANAC_IMAGES_DIR, img.filename);
      if (fp.startsWith(canonicalDir + "/") && existsSync(fp)) {
        try {
          unlinkSync(fp);
        } catch (err) {
          request.log.warn({ err, filename: img.filename }, "Failed to unlink almanac image");
        }
      }
      db.delete(almanacImages).where(eq(almanacImages.id, id)).run();
      return reply.status(204).send();
    },
  );
}
