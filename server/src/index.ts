import { existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import Fastify, { type FastifyError } from "fastify";
import fastifyStatic from "@fastify/static";
import cors from "@fastify/cors";
import { ZodError } from "zod";
import { db } from "./db/index.js";
import { authPlugin } from "./plugins/auth.js";
import { authRoutes } from "./routes/auth.js";
import { inviteRoutes } from "./routes/invites.js";
import { userRoutes } from "./routes/users.js";
import { locationRoutes } from "./routes/locations.js";
import { zoneRoutes } from "./routes/zones.js";
import { plantRoutes } from "./routes/plants.js";
import { careTaskRoutes } from "./routes/care-tasks.js";
import { shoppingListRoutes } from "./routes/shopping-list.js";
import { fertilizerRoutes } from "./routes/fertilizers.js";
import { weatherRoutes } from "./routes/weather.js";
import { sunRoutes } from "./routes/sun.js";
import { photoRoutes } from "./routes/photos.js";
import { journalRoutes } from "./routes/journal.js";
import { notificationRoutes } from "./routes/notifications.js";
import { settingsRoutes } from "./routes/settings.js";
import { wildlifeRoutes } from "./routes/wildlife.js";
import { alertRoutes } from "./routes/alerts.js";
import dashboardRoutes from "./routes/dashboard.js";
import { startScheduler } from "./services/scheduler.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = Fastify({ logger: true });

await app.register(cors, {
  origin: process.env.CORS_ORIGIN || false,
  credentials: true,
});

// Auth plugin — cookies, session validation, role decorators
await app.register(authPlugin);

// Global error handler
app.setErrorHandler((error, request, reply) => {
  if (error instanceof ZodError) {
    return reply.status(400).send({
      error: "Validation error",
      details: error.issues.map((i) => i.message),
    });
  }

  // Fastify validation errors (schema-based)
  const fastifyErr = error as FastifyError;
  if (fastifyErr.validation) {
    return reply.status(400).send({ error: fastifyErr.message });
  }

  // Log the full error internally, return sanitized response
  request.log.error(error, "Unhandled error");
  return reply.status(500).send({ error: "Internal server error" });
});

// Auth routes (public — no guards on the plugin itself)
await app.register(authRoutes, { prefix: "/api/auth" });
await app.register(inviteRoutes, { prefix: "/api/auth/invites" });
await app.register(userRoutes, { prefix: "/api/users" });

// App routes (auth guards applied within each route file)
await app.register(locationRoutes, { prefix: "/api/locations" });
await app.register(zoneRoutes, { prefix: "/api/zones" });
await app.register(plantRoutes, { prefix: "/api/plants" });
await app.register(careTaskRoutes, { prefix: "/api/care-tasks" });
await app.register(shoppingListRoutes, { prefix: "/api/shopping-list" });
await app.register(fertilizerRoutes, { prefix: "/api/locations/:locationId/fertilizers" });
await app.register(weatherRoutes, { prefix: "/api/weather" });
await app.register(sunRoutes, { prefix: "/api/sun" });
await app.register(photoRoutes, { prefix: "/api/photos" });
await app.register(journalRoutes, { prefix: "/api/journal" });
await app.register(notificationRoutes, { prefix: "/api/notifications" });
await app.register(settingsRoutes, { prefix: "/api/settings" });
await app.register(wildlifeRoutes, { prefix: "/api/wildlife" });
await app.register(alertRoutes, { prefix: "/api/alerts" });
await app.register(dashboardRoutes, { prefix: "/api/locations" });

// Health check
app.get("/api/health", async () => ({
  status: "ok",
  name: "bramble",
  version: "0.1.0",
}));

// Serve frontend static files in production
const webDistPath = resolve(__dirname, "../../web/dist");
if (existsSync(webDistPath)) {
  await app.register(fastifyStatic, {
    root: webDistPath,
    prefix: "/",
    wildcard: true,
  });

  // SPA fallback — serve index.html for non-API routes
  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith("/api/")) {
      reply.status(404).send({ error: "Not found" });
    } else {
      reply.sendFile("index.html");
    }
  });
}

const port = parseInt(process.env.PORT ?? "3000", 10);
const host = process.env.HOST ?? "0.0.0.0";

try {
  await app.listen({ port, host });
  console.log(`🌿 Bramble server running on http://${host}:${port}`);

  // Start the scheduler (skip in test mode)
  if (process.env.NODE_ENV !== "test") {
    startScheduler();
  }
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
