import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { calculatePlantMood, type MoodContext } from "./mood.js";
import type { PlantInstance, PlantReference, CareTaskLog, WeatherCacheEntry } from "../db/schema.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRef(overrides: Partial<PlantReference> = {}): PlantReference {
  return {
    id: 1,
    commonName: "Test Plant",
    latinName: null,
    cultivar: null,
    family: null,
    plantType: "flower",
    sunRequirement: "partial_sun",
    waterNeeds: "moderate",
    soilPreference: null,
    hardinessZoneMin: null,
    hardinessZoneMax: null,
    matureHeight: null,
    matureSpread: null,
    growthRate: null,
    bloomTime: null,
    bloomColor: null,
    foliageType: null,
    toxicityDogs: "safe",
    toxicityCats: "safe",
    toxicityChildren: "safe",
    toxicityNotes: null,
    spriteType: "flower",
    lifecycle: null,
    plantingNotes: null,
    pruningNotes: null,
    overwinteringNotes: null,
    nativeRegion: null,
    deerResistant: null,
    droughtTolerant: null,
    containerSuitable: null,
    attractsPollinators: null,
    attractsBirds: null,
    attractsButterflies: null,
    companionPlants: null,
    minTempF: null,
    maxTempF: null,
    source: "user",
    externalId: null,
    description: null,
    careNotes: null,
    fertilizerType: null,
    fertilizerNpk: null,
    fertilizerFrequency: null,
    fertilizerNotes: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeInstance(overrides: Partial<PlantInstance> = {}): PlantInstance {
  return {
    id: 1,
    plantReferenceId: 1,
    zoneId: null,
    nickname: null,
    status: "established",
    isContainer: false,
    containerDescription: null,
    containerSize: null,
    containerShape: null,
    containerMaterial: null,
    outdoorCandidate: false,
    datePlanted: "2025-06-01",
    dateRemoved: null,
    notes: null,
    notifyWater: null,
    notifyFertilize: null,
    notifyPrune: null,
    notifyRepot: null,
    notifyInspect: null,
    notifyProtect: null,
    spriteOverride: null,
    mood: "happy",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeWeather(overrides: Partial<WeatherCacheEntry> = {}): WeatherCacheEntry {
  return {
    id: 1,
    locationId: 1,
    temperature: 65,
    temperatureHigh: 75,
    temperatureLow: 55,
    humidity: 50,
    precipitation: 0,
    windSpeed: 5,
    conditions: "clear",
    forecastJson: null,
    uvIndex: null,
    precipitationProbability: null,
    soilTemperature: null,
    windGust: null,
    fetchedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeWaterLog(completedAt: string): CareTaskLog {
  return {
    id: 1,
    careTaskId: 1,
    action: "completed",
    notes: null,
    photoId: null,
    createdBy: null,
    rainProvisional: false,
    completedAt,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("calculatePlantMood", () => {
  describe("status-based moods", () => {
    it("returns 'sleeping' for dormant plants", () => {
      const result = calculatePlantMood(
        makeInstance({ status: "dormant" }),
        makeRef(),
      );
      expect(result).toBe("sleeping");
    });

    it("returns 'wilting' for dead plants", () => {
      const result = calculatePlantMood(
        makeInstance({ status: "dead" }),
        makeRef(),
      );
      expect(result).toBe("wilting");
    });

    it("returns 'wilting' for removed plants", () => {
      const result = calculatePlantMood(
        makeInstance({ status: "removed" }),
        makeRef(),
      );
      expect(result).toBe("wilting");
    });

    it("returns 'new' for planned plants", () => {
      const result = calculatePlantMood(
        makeInstance({ status: "planned" }),
        makeRef(),
      );
      expect(result).toBe("new");
    });

    it("returns 'new' for plants without a datePlanted", () => {
      const result = calculatePlantMood(
        makeInstance({ datePlanted: null, status: "established" }),
        makeRef(),
      );
      expect(result).toBe("new");
    });

    it("returns 'wilting' for struggling plants (when no weather/care overrides)", () => {
      const result = calculatePlantMood(
        makeInstance({ status: "struggling" }),
        makeRef(),
      );
      expect(result).toBe("wilting");
    });
  });

  describe("weather-based moods", () => {
    it("returns 'cold' when temperature is below plant minimum", () => {
      const result = calculatePlantMood(
        makeInstance(),
        makeRef({ minTempF: 40 }),
        { weather: makeWeather({ temperature: 30 }) },
      );
      expect(result).toBe("cold");
    });

    it("returns 'hot' when temperature is above plant maximum", () => {
      const result = calculatePlantMood(
        makeInstance(),
        makeRef({ maxTempF: 90 }),
        { weather: makeWeather({ temperature: 100 }) },
      );
      expect(result).toBe("hot");
    });

    it("returns 'happy' when temperature is within range", () => {
      const result = calculatePlantMood(
        makeInstance(),
        makeRef({ minTempF: 30, maxTempF: 100 }),
        { weather: makeWeather({ temperature: 65 }) },
      );
      expect(result).toBe("happy");
    });

    it("does not check weather when weather data is null", () => {
      const result = calculatePlantMood(
        makeInstance(),
        makeRef({ minTempF: 60 }),
        { weather: null },
      );
      expect(result).toBe("happy");
    });

    it("does not check weather when weather temperature is null", () => {
      const result = calculatePlantMood(
        makeInstance(),
        makeRef({ minTempF: 60 }),
        { weather: makeWeather({ temperature: null }) },
      );
      expect(result).toBe("happy");
    });

    it("handles minTempF=null gracefully (skips cold check)", () => {
      const result = calculatePlantMood(
        makeInstance(),
        makeRef({ minTempF: null, maxTempF: 100 }),
        { weather: makeWeather({ temperature: 10 }) },
      );
      expect(result).toBe("happy");
    });

    it("handles maxTempF=null gracefully (skips hot check)", () => {
      const result = calculatePlantMood(
        makeInstance(),
        makeRef({ minTempF: 30, maxTempF: null }),
        { weather: makeWeather({ temperature: 120 }) },
      );
      expect(result).toBe("happy");
    });
  });

  describe("watering-based moods", () => {
    let realDateNow: () => number;

    beforeEach(() => {
      realDateNow = Date.now;
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("returns 'thirsty' when last watered was more than 2x interval ago", () => {
      // Set "now" to a fixed point
      const now = new Date("2026-03-10T12:00:00Z");
      vi.spyOn(global, "Date").mockImplementation((...args: unknown[]) => {
        if (args.length === 0) return now;
        // @ts-expect-error -- constructing Date with arguments
        return new realDateNow.constructor(...args);
      });
      // Mock Date.now() for getTime
      const originalDate = globalThis.Date;
      // Actually, let's just use a simpler approach: set watered 20 days ago with 7-day interval
      vi.restoreAllMocks();

      const twentyDaysAgo = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString();
      const result = calculatePlantMood(
        makeInstance(),
        makeRef(),
        {
          lastWaterLog: makeWaterLog(twentyDaysAgo),
          waterIntervalDays: 7,
        },
      );
      expect(result).toBe("thirsty");
    });

    it("returns 'happy' when last watered within 2x interval", () => {
      const oneDayAgo = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
      const result = calculatePlantMood(
        makeInstance(),
        makeRef(),
        {
          lastWaterLog: makeWaterLog(oneDayAgo),
          waterIntervalDays: 7,
        },
      );
      expect(result).toBe("happy");
    });

    it("does not return thirsty when waterIntervalDays is null", () => {
      const longAgo = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString();
      const result = calculatePlantMood(
        makeInstance(),
        makeRef(),
        {
          lastWaterLog: makeWaterLog(longAgo),
          waterIntervalDays: null,
        },
      );
      expect(result).toBe("happy");
    });

    it("does not return thirsty when lastWaterLog is null", () => {
      const result = calculatePlantMood(
        makeInstance(),
        makeRef(),
        {
          lastWaterLog: null,
          waterIntervalDays: 7,
        },
      );
      expect(result).toBe("happy");
    });
  });

  describe("mood priority", () => {
    it("dormant overrides weather cold", () => {
      const result = calculatePlantMood(
        makeInstance({ status: "dormant" }),
        makeRef({ minTempF: 40 }),
        { weather: makeWeather({ temperature: 20 }) },
      );
      expect(result).toBe("sleeping");
    });

    it("dead overrides everything", () => {
      const oneDayAgo = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString();
      const result = calculatePlantMood(
        makeInstance({ status: "dead" }),
        makeRef({ minTempF: 40 }),
        {
          weather: makeWeather({ temperature: 20 }),
          lastWaterLog: makeWaterLog(oneDayAgo),
          waterIntervalDays: 7,
        },
      );
      expect(result).toBe("wilting");
    });

    it("weather cold takes priority over thirsty", () => {
      const longAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const result = calculatePlantMood(
        makeInstance(),
        makeRef({ minTempF: 40 }),
        {
          weather: makeWeather({ temperature: 20 }),
          lastWaterLog: makeWaterLog(longAgo),
          waterIntervalDays: 7,
        },
      );
      expect(result).toBe("cold");
    });

    it("weather hot takes priority over thirsty", () => {
      const longAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const result = calculatePlantMood(
        makeInstance(),
        makeRef({ maxTempF: 90 }),
        {
          weather: makeWeather({ temperature: 110 }),
          lastWaterLog: makeWaterLog(longAgo),
          waterIntervalDays: 7,
        },
      );
      expect(result).toBe("hot");
    });

    it("thirsty takes priority over struggling/wilting", () => {
      const longAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const result = calculatePlantMood(
        makeInstance({ status: "struggling" }),
        makeRef(),
        {
          lastWaterLog: makeWaterLog(longAgo),
          waterIntervalDays: 7,
        },
      );
      expect(result).toBe("thirsty");
    });
  });

  describe("rain awareness", () => {
    it("returns happy when overdue but rain today (above threshold)", () => {
      const longAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const result = calculatePlantMood(
        makeInstance(),
        makeRef(),
        {
          lastWaterLog: makeWaterLog(longAgo),
          waterIntervalDays: 7,
          dailyPrecipitation: 0.5,
        },
      );
      expect(result).toBe("happy");
    });

    it("returns thirsty when overdue and rain below threshold", () => {
      const longAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const result = calculatePlantMood(
        makeInstance(),
        makeRef(),
        {
          lastWaterLog: makeWaterLog(longAgo),
          waterIntervalDays: 7,
          dailyPrecipitation: 0.1,
        },
      );
      expect(result).toBe("thirsty");
    });

    it("returns thirsty when overdue and dailyPrecipitation is null", () => {
      const longAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const result = calculatePlantMood(
        makeInstance(),
        makeRef(),
        {
          lastWaterLog: makeWaterLog(longAgo),
          waterIntervalDays: 7,
          dailyPrecipitation: null,
        },
      );
      expect(result).toBe("thirsty");
    });

    it("returns happy when exactly at rain threshold", () => {
      const longAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const result = calculatePlantMood(
        makeInstance(),
        makeRef(),
        {
          lastWaterLog: makeWaterLog(longAgo),
          waterIntervalDays: 7,
          dailyPrecipitation: 0.25,
        },
      );
      expect(result).toBe("happy");
    });
  });

  describe("default behavior", () => {
    it("returns 'happy' for established plant with no context", () => {
      const result = calculatePlantMood(makeInstance(), makeRef());
      expect(result).toBe("happy");
    });

    it("returns 'happy' for established plant with empty context", () => {
      const result = calculatePlantMood(makeInstance(), makeRef(), {});
      expect(result).toBe("happy");
    });

    it("returns 'happy' for planted plant with a datePlanted", () => {
      const result = calculatePlantMood(
        makeInstance({ status: "planted", datePlanted: "2025-06-01" }),
        makeRef(),
      );
      expect(result).toBe("happy");
    });
  });
});
