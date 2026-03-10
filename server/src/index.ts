import { existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import cors from "@fastify/cors";
import { db } from "./db/index.js";
import { locationRoutes } from "./routes/locations.js";
import { zoneRoutes } from "./routes/zones.js";
import { plantRoutes } from "./routes/plants.js";
import { careTaskRoutes } from "./routes/care-tasks.js";
import { shoppingListRoutes } from "./routes/shopping-list.js";
import { weatherRoutes } from "./routes/weather.js";
import { sunRoutes } from "./routes/sun.js";
import { photoRoutes } from "./routes/photos.js";
import { notificationRoutes } from "./routes/notifications.js";
import { settingsRoutes } from "./routes/settings.js";
import { wildlifeRoutes } from "./routes/wildlife.js";
import { alertRoutes } from "./routes/alerts.js";
import { startScheduler } from "./services/scheduler.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = Fastify({ logger: true });

await app.register(cors, {
  origin: process.env.CORS_ORIGIN ?? true,
});

// Register routes
await app.register(locationRoutes, { prefix: "/api/locations" });
await app.register(zoneRoutes, { prefix: "/api/zones" });
await app.register(plantRoutes, { prefix: "/api/plants" });
await app.register(careTaskRoutes, { prefix: "/api/care-tasks" });
await app.register(shoppingListRoutes, { prefix: "/api/shopping-list" });
await app.register(weatherRoutes, { prefix: "/api/weather" });
await app.register(sunRoutes, { prefix: "/api/sun" });
await app.register(photoRoutes, { prefix: "/api/photos" });
await app.register(notificationRoutes, { prefix: "/api/notifications" });
await app.register(settingsRoutes, { prefix: "/api/settings" });
await app.register(wildlifeRoutes, { prefix: "/api/wildlife" });
await app.register(alertRoutes, { prefix: "/api/alerts" });

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
