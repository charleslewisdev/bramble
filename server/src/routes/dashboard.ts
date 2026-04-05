import type { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import {
  locations,
  weatherCache,
  plantInstances,
  careTasks,
  zones,
  settings,
} from "../db/schema.js";
import { eq, desc, sql, inArray } from "drizzle-orm";
import { idParamSchema } from "../lib/validation.js";
import { sendSuccess, sendError } from "../lib/responses.js";
import { fetchWeather } from "../services/weather.js";
import { getSunInfo } from "../services/sun.js";
import { checkWeatherAlerts } from "../services/alerts.js";
import SunCalc from "suncalc";
import { requireAuth } from "../plugins/auth.js";

export default async function dashboardRoutes(app: FastifyInstance) {
  // Auth: require login for all routes in this plugin
  app.addHook("onRequest", requireAuth);

  // GET /api/locations/:id/dashboard - aggregate all dashboard data for a location
  app.get<{ Params: { id: string } }>(
    "/:id/dashboard",
    async (request, reply) => {
      const paramsParsed = idParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return sendError(reply, 400, "Invalid ID");
      }
      const locationId = Number(paramsParsed.data.id);

      // Fetch location
      const location = await db.query.locations.findFirst({
        where: eq(locations.id, locationId),
      });

      if (!location) {
        return sendError(reply, 404, "Location not found");
      }

      // Fetch all locations (dashboard shows all)
      const allLocations = await db.query.locations.findMany();

      // Fetch settings
      const settingsRows = db.select().from(settings).all();
      const settingsMap: Record<string, unknown> = {};
      for (const row of settingsRows) {
        settingsMap[row.key] = row.value;
      }

      // Fetch all plant instances (dashboard shows all plants, not location-scoped)
      const allPlantInstances = await db.query.plantInstances.findMany({
        with: { plantReference: true },
      });

      // Fetch upcoming care tasks
      const upcomingCareTasks = db
        .select()
        .from(careTasks)
        .where(sql`${careTasks.dueDate} >= date('now')`)
        .all();

      // Per-location data for all locations
      const locationDataPromises = allLocations.map(async (loc) => {
        // Weather - check cache first
        let weather = null;
        const cached = db
          .select()
          .from(weatherCache)
          .where(eq(weatherCache.locationId, loc.id))
          .orderBy(desc(weatherCache.fetchedAt))
          .limit(1)
          .all();

        const latestCached = cached[0];
        if (latestCached) {
          const fetchedAt = new Date(latestCached.fetchedAt);
          const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
          if (fetchedAt > oneHourAgo) {
            weather = { ...latestCached, fromCache: true };
          }
        }

        if (!weather && loc.latitude && loc.longitude) {
          try {
            const freshWeather = await fetchWeather(loc.latitude, loc.longitude);
            // Cache it
            db.transaction((tx) => {
              tx.delete(weatherCache).where(eq(weatherCache.locationId, loc.id)).run();
              tx.insert(weatherCache)
                .values({
                  locationId: loc.id,
                  temperature: freshWeather.current.temperature,
                  temperatureHigh: freshWeather.daily.temperatureMax,
                  temperatureLow: freshWeather.daily.temperatureMin,
                  humidity: freshWeather.current.humidity,
                  precipitation: freshWeather.current.precipitation,
                  windSpeed: freshWeather.current.windSpeed,
                  conditions: freshWeather.current.conditions,
                  forecastJson: freshWeather.forecast,
                  uvIndex: freshWeather.current.uvIndex,
                  precipitationProbability: freshWeather.daily.precipitationProbability,
                  soilTemperature: freshWeather.soilTemperature,
                  windGust: freshWeather.current.windGust,
                })
                .run();
            });
            // Re-read from cache to get consistent shape
            const newCached = db
              .select()
              .from(weatherCache)
              .where(eq(weatherCache.locationId, loc.id))
              .orderBy(desc(weatherCache.fetchedAt))
              .limit(1)
              .all();
            weather = newCached[0] ? { ...newCached[0], fromCache: false } : null;
          } catch {
            // If fetch fails but we have stale cache, use it
            if (latestCached) {
              weather = { ...latestCached, fromCache: true, stale: true };
            }
          }
        }

        // Sun data
        let sunData = null;
        if (loc.latitude && loc.longitude) {
          const date = new Date();
          const sunInfo = getSunInfo(loc.latitude, loc.longitude, date);
          sunData = {
            locationId: loc.id,
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
        }

        // Sun position
        let sunPosition = null;
        if (loc.latitude && loc.longitude) {
          const now = new Date();
          const position = SunCalc.getPosition(now, loc.latitude, loc.longitude);
          sunPosition = {
            locationId: loc.id,
            timestamp: now.toISOString(),
            azimuth: (position.azimuth * 180) / Math.PI + 180,
            altitude: (position.altitude * 180) / Math.PI,
          };
        }

        // Alerts
        let alerts: { alerts: unknown[]; message?: string } = { alerts: [] };
        const weatherForAlerts = cached[0] ?? null;
        if (weatherForAlerts) {
          const locationZones = db
            .select({ id: zones.id })
            .from(zones)
            .where(eq(zones.locationId, loc.id))
            .all();
          const zoneIds = locationZones.map((z) => z.id);
          const plants = zoneIds.length > 0
            ? await db.query.plantInstances.findMany({
                where: inArray(plantInstances.zoneId, zoneIds),
                with: { plantReference: true },
              })
            : [];
          const alertList = checkWeatherAlerts(loc.id, weatherForAlerts, plants);
          alerts = { alerts: alertList };
        } else {
          alerts = { alerts: [], message: "No weather data available" };
        }

        return {
          locationId: loc.id,
          weather,
          sunData,
          sunPosition,
          alerts,
        };
      });

      const locationData = await Promise.all(locationDataPromises);

      // Build response indexed by location ID
      const perLocation: Record<number, {
        weather: unknown;
        sunData: unknown;
        sunPosition: unknown;
        alerts: unknown;
      }> = {};
      for (const ld of locationData) {
        perLocation[ld.locationId] = {
          weather: ld.weather,
          sunData: ld.sunData,
          sunPosition: ld.sunPosition,
          alerts: ld.alerts,
        };
      }

      return sendSuccess(reply, {
        locations: allLocations,
        plants: allPlantInstances,
        upcomingTasks: upcomingCareTasks,
        settings: settingsMap,
        perLocation,
      });
    },
  );
}
