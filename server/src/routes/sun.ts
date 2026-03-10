import { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { locations, structures } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { getSunInfo } from "../services/sun.js";
import { calculateShadows } from "../services/shadows.js";
import { z } from "zod";

const locationIdParamSchema = z.object({
  locationId: z.string().refine((v) => !isNaN(Number(v)) && Number(v) > 0 && Number.isInteger(Number(v)), {
    message: "Invalid ID",
  }),
});

function parseDateParam(dateStr: string | undefined): Date {
  if (dateStr) {
    const parsed = new Date(dateStr + "T12:00:00");
    if (!isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

function parseDateTimeParams(dateStr: string | undefined, timeStr: string | undefined): Date {
  const date = parseDateParam(dateStr);
  if (timeStr) {
    const [hours, minutes] = timeStr.split(":").map(Number);
    if (hours !== undefined && minutes !== undefined && !isNaN(hours) && !isNaN(minutes)) {
      date.setHours(hours, minutes, 0, 0);
    }
  }
  return date;
}

export async function sunRoutes(app: FastifyInstance) {
  // GET /:locationId - get sun info for a date (default today)
  app.get<{ Params: { locationId: string }; Querystring: { date?: string } }>(
    "/:locationId",
    async (request, reply) => {
      const paramsParsed = locationIdParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({ error: "Invalid ID" });
      }
      const locationId = Number(request.params.locationId);
      const location = await db.query.locations.findFirst({
        where: eq(locations.id, locationId),
      });

      if (!location) {
        return reply.status(404).send({ error: "Location not found" });
      }

      const date = parseDateParam(request.query.date);
      const sunInfo = getSunInfo(location.latitude, location.longitude, date);

      return {
        locationId,
        date: date.toISOString().split("T")[0],
        sunrise: sunInfo.sunrise.toISOString(),
        sunset: sunInfo.sunset.toISOString(),
        solarNoon: sunInfo.solarNoon.toISOString(),
        dayLength: sunInfo.dayLengthFormatted,
        dayLengthMinutes: sunInfo.dayLengthMinutes,
        goldenHour: {
          start: sunInfo.goldenHourStart.toISOString(),
          end: sunInfo.goldenHourEnd.toISOString(),
        },
      };
    },
  );

  // GET /:locationId/position - get sun position at a date/time (default now)
  app.get<{ Params: { locationId: string }; Querystring: { date?: string; time?: string } }>(
    "/:locationId/position",
    async (request, reply) => {
      const paramsParsed = locationIdParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({ error: "Invalid ID" });
      }
      const locationId = Number(request.params.locationId);
      const location = await db.query.locations.findFirst({
        where: eq(locations.id, locationId),
      });

      if (!location) {
        return reply.status(404).send({ error: "Location not found" });
      }

      const dateTime = parseDateTimeParams(request.query.date, request.query.time);
      const sunInfo = getSunInfo(location.latitude, location.longitude, dateTime);

      return {
        locationId,
        timestamp: dateTime.toISOString(),
        azimuth: sunInfo.sunPosition.azimuth,
        altitude: sunInfo.sunPosition.altitude,
      };
    },
  );

  // GET /:locationId/day-arc - hourly sun positions from sunrise to sunset
  app.get<{ Params: { locationId: string }; Querystring: { date?: string } }>(
    "/:locationId/day-arc",
    async (request, reply) => {
      const paramsParsed = locationIdParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({ error: "Invalid ID" });
      }
      const locationId = Number(request.params.locationId);
      const location = await db.query.locations.findFirst({
        where: eq(locations.id, locationId),
      });

      if (!location) {
        return reply.status(404).send({ error: "Location not found" });
      }

      const date = parseDateParam(request.query.date);
      const sunInfo = getSunInfo(location.latitude, location.longitude, date);
      const sunrise = sunInfo.sunrise;
      const sunset = sunInfo.sunset;

      // Generate hourly positions from sunrise to sunset
      const positions: Array<{
        time: string;
        azimuth: number;
        altitude: number;
      }> = [];

      const current = new Date(sunrise);
      while (current <= sunset) {
        const info = getSunInfo(location.latitude, location.longitude, current);
        positions.push({
          time: current.toISOString(),
          azimuth: info.sunPosition.azimuth,
          altitude: info.sunPosition.altitude,
        });
        current.setHours(current.getHours() + 1);
      }

      return {
        locationId,
        date: date.toISOString().split("T")[0],
        sunrise: sunrise.toISOString(),
        sunset: sunset.toISOString(),
        positions,
      };
    },
  );

  // GET /:locationId/shadows - shadow polygons for all structures at a given time
  app.get<{ Params: { locationId: string }; Querystring: { date?: string; time?: string } }>(
    "/:locationId/shadows",
    async (request, reply) => {
      const paramsParsed = locationIdParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({ error: "Invalid ID" });
      }
      const locationId = Number(request.params.locationId);
      const location = await db.query.locations.findFirst({
        where: eq(locations.id, locationId),
      });

      if (!location) {
        return reply.status(404).send({ error: "Location not found" });
      }

      const dateTime = parseDateTimeParams(request.query.date, request.query.time);
      const sunInfo = getSunInfo(location.latitude, location.longitude, dateTime);

      // Get all structures for this location
      const locationStructures = await db
        .select()
        .from(structures)
        .where(eq(structures.locationId, locationId))
        .all();

      const shadows = calculateShadows(
        locationStructures,
        sunInfo.sunPosition.azimuth,
        sunInfo.sunPosition.altitude,
        location.compassOrientation ?? 0,
      );

      return {
        locationId,
        timestamp: dateTime.toISOString(),
        sunAzimuth: sunInfo.sunPosition.azimuth,
        sunAltitude: sunInfo.sunPosition.altitude,
        shadows,
      };
    },
  );
}
