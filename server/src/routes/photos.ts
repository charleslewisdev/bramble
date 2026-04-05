import { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { plantPhotos, plantInstances } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { existsSync, mkdirSync, writeFileSync, unlinkSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import { z } from "zod";
import { generateThumbnail } from "../services/thumbnails.js";
import { requireAuth, requireRole } from "../plugins/auth.js";

const __photos_dirname = dirname(fileURLToPath(import.meta.url));
const PHOTOS_DIR = process.env.PHOTOS_DIR ?? resolve(__photos_dirname, "../../data/photos");

function ensurePhotosDir() {
  if (!existsSync(PHOTOS_DIR)) {
    mkdirSync(PHOTOS_DIR, { recursive: true });
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
    default:
      return "application/octet-stream";
  }
}

/**
 * Validate that a filename is safe (no path traversal).
 * Rejects filenames containing "..", "/", or "\".
 */
function isValidFilename(filename: string): boolean {
  if (!filename || filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
    return false;
  }
  return true;
}

const uploadPhotoSchema = z.object({
  plantInstanceId: z.number().int().positive(),
  imageData: z.string().min(1),
  caption: z.string().optional(),
});

import { idParamSchema } from "../lib/validation.js";

const filenameParamSchema = z.object({
  filename: z.string().min(1).refine(isValidFilename, { message: "Invalid filename" }),
});

export async function photoRoutes(app: FastifyInstance) {
  // Auth: require login for all routes in this plugin
  app.addHook("onRequest", requireAuth);

  // GET / - list photos for a plant instance
  app.get<{ Querystring: { plantInstanceId?: string } }>("/", async (request, reply) => {
    const { plantInstanceId } = request.query;
    if (!plantInstanceId) {
      return reply.status(400).send({ error: "plantInstanceId query parameter is required" });
    }
    const id = Number(plantInstanceId);
    if (isNaN(id) || id <= 0) {
      return reply.status(400).send({ error: "Invalid plantInstanceId" });
    }
    const photos = db
      .select()
      .from(plantPhotos)
      .where(eq(plantPhotos.plantInstanceId, id))
      .all();
    return photos;
  });

  // POST / - upload photo as base64
  app.post("/", { bodyLimit: 10 * 1024 * 1024 }, async (request, reply) => {
    const parsed = uploadPhotoSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid request body" });
    }
    const { plantInstanceId, imageData, caption } = parsed.data;

    // Verify plant instance exists
    const instance = await db.query.plantInstances.findFirst({
      where: eq(plantInstances.id, plantInstanceId),
    });

    if (!instance) {
      return reply.status(404).send({ error: "Plant instance not found" });
    }

    // Detect image format from base64 header or default to jpg
    let extension = "jpg";
    let rawBase64 = imageData;

    if (imageData.startsWith("data:")) {
      const match = imageData.match(/^data:image\/(\w+);base64,/);
      if (match) {
        extension = match[1] === "jpeg" ? "jpg" : match[1]!;
        rawBase64 = imageData.replace(/^data:image\/\w+;base64,/, "");
      }
    }

    const filename = `${randomUUID()}.${extension}`;
    const buffer = Buffer.from(rawBase64, "base64");

    ensurePhotosDir();
    writeFileSync(resolve(PHOTOS_DIR, filename), buffer);

    // Generate thumbnail
    let thumbnailFilename: string | null = null;
    try {
      thumbnailFilename = await generateThumbnail(PHOTOS_DIR, filename);
    } catch (err) {
      request.log.warn({ err, filename }, "Thumbnail generation failed");
    }

    const result = db
      .insert(plantPhotos)
      .values({
        plantInstanceId,
        filename,
        thumbnailFilename,
        caption: caption ?? null,
        createdBy: request.user?.id ?? null,
      })
      .returning()
      .get();

    return reply.status(201).send(result);
  });

  // GET /file/:filename - serve photo file
  app.get<{ Params: { filename: string } }>(
    "/file/:filename",
    async (request, reply) => {
      const paramsParsed = filenameParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({ error: "Invalid filename" });
      }
      const { filename } = paramsParsed.data;

      const filepath = resolve(PHOTOS_DIR, filename);

      // Path traversal protection: ensure resolved path is within PHOTOS_DIR
      const canonicalPhotosDir = resolve(PHOTOS_DIR);
      if (!filepath.startsWith(canonicalPhotosDir + "/") && filepath !== canonicalPhotosDir) {
        return reply.status(400).send({ error: "Invalid filename" });
      }

      if (!existsSync(filepath)) {
        return reply.status(404).send({ error: "Photo file not found" });
      }

      const contentType = getContentType(filename);
      const buffer = readFileSync(filepath);

      return reply.type(contentType).send(buffer);
    },
  );

  // DELETE /:id - delete photo record and file
  app.delete<{ Params: { id: string } }>("/:id", { preHandler: requireRole("gardener") }, async (request, reply) => {
    const paramsParsed = idParamSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      return reply.status(400).send({ error: "Invalid ID" });
    }
    const id = Number(request.params.id);
    const photo = await db.query.plantPhotos.findFirst({
      where: eq(plantPhotos.id, id),
    });

    if (!photo) {
      return reply.status(404).send({ error: "Photo not found" });
    }

    // Delete file and thumbnail if they exist
    const canonicalPhotosDir = resolve(PHOTOS_DIR);
    const filepath = resolve(PHOTOS_DIR, photo.filename);
    if (filepath.startsWith(canonicalPhotosDir + "/") && existsSync(filepath)) {
      unlinkSync(filepath);
    }
    if (photo.thumbnailFilename) {
      const thumbPath = resolve(PHOTOS_DIR, photo.thumbnailFilename);
      if (thumbPath.startsWith(canonicalPhotosDir + "/") && existsSync(thumbPath)) {
        unlinkSync(thumbPath);
      }
    }

    db.delete(plantPhotos).where(eq(plantPhotos.id, id)).run();
    return reply.status(204).send();
  });
}
