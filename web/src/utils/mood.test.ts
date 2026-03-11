import { describe, it, expect } from "vitest";
import { calculateMood, getCurrentSeason, getSeasonalSummary, getFrostInfo } from "./mood";
import type { PlantMood, PlantInstance, CareTask, Weather } from "../api";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makePlant(overrides: Partial<PlantInstance> = {}): PlantInstance {
  return {
    id: 1,
    plantReferenceId: 1,
    zoneId: null,
    nickname: null,
    status: "established",
    isContainer: false,
    containerDescription: null,
    datePlanted: "2025-06-01",
    dateRemoved: null,
    notes: null,
    mood: "happy",
    spriteOverride: null,
    plantReference: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  } as PlantInstance;
}

function makeTask(overrides: Partial<CareTask> = {}): CareTask {
  const now = new Date().toISOString();
  return {
    id: 1,
    plantInstanceId: 1,
    zoneId: null,
    locationId: null,
    taskType: "water",
    title: "Water plant",
    description: null,
    dueDate: null,
    isRecurring: false,
    intervalDays: null,
    activeMonths: null,
    sendNotification: true,
    lastNotifiedAt: null,
    plantMessage: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as CareTask;
}

// ─── calculateMood ──────────────────────────────────────────────────────────

describe("calculateMood", () => {
  describe("status-based moods", () => {
    it("returns 'sleeping' for dormant plants", () => {
      expect(calculateMood({ plant: makePlant({ status: "dormant" }) })).toBe("sleeping");
    });

    it("returns 'new' for planned plants without completed tasks", () => {
      expect(calculateMood({ plant: makePlant({ status: "planned" }) })).toBe("new");
    });

    it("returns 'new' for planted plants without completed tasks", () => {
      expect(calculateMood({ plant: makePlant({ status: "planted" }) })).toBe("new");
    });

    it("returns 'wilting' for dead plants", () => {
      expect(calculateMood({ plant: makePlant({ status: "dead" }) })).toBe("wilting");
    });

    it("returns 'wilting' for removed plants", () => {
      expect(calculateMood({ plant: makePlant({ status: "removed" }) })).toBe("wilting");
    });

    it("returns 'wilting' for struggling plants", () => {
      expect(calculateMood({ plant: makePlant({ status: "struggling" }) })).toBe("wilting");
    });
  });

  describe("weather-based moods", () => {
    it("returns 'cold' when temp is below plant minTempF", () => {
      const plant = makePlant({
        plantReference: { minTempF: 40, maxTempF: 100 } as PlantInstance["plantReference"],
      });
      const weather = { temperature: 30 } as Weather;
      expect(calculateMood({ plant, weather })).toBe("cold");
    });

    it("returns 'hot' when temp is above plant maxTempF", () => {
      const plant = makePlant({
        plantReference: { minTempF: 20, maxTempF: 90 } as PlantInstance["plantReference"],
      });
      const weather = { temperature: 100 } as Weather;
      expect(calculateMood({ plant, weather })).toBe("hot");
    });

    it("returns 'cold' when temp < 35 and no plant-specific thresholds", () => {
      const plant = makePlant({
        plantReference: { minTempF: null, maxTempF: null } as PlantInstance["plantReference"],
      });
      const weather = { temperature: 30 } as Weather;
      expect(calculateMood({ plant, weather })).toBe("cold");
    });

    it("returns 'hot' when temp > 100 and no plant-specific thresholds", () => {
      const plant = makePlant({
        plantReference: { minTempF: null, maxTempF: null } as PlantInstance["plantReference"],
      });
      const weather = { temperature: 105 } as Weather;
      expect(calculateMood({ plant, weather })).toBe("hot");
    });

    it("does not check weather when weather is null", () => {
      expect(calculateMood({ plant: makePlant(), weather: null })).toBe("happy");
    });

    it("does not check weather when temperature is null", () => {
      const weather = { temperature: null } as unknown as Weather;
      expect(calculateMood({ plant: makePlant(), weather })).toBe("happy");
    });
  });

  describe("care-based moods", () => {
    it("returns 'thirsty' for tasks overdue by 1-3 days", () => {
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      const dueDateStr = twoDaysAgo.toISOString().slice(0, 10);

      const tasks = [makeTask({ dueDate: dueDateStr })];
      expect(calculateMood({ plant: makePlant(), tasks })).toBe("thirsty");
    });

    it("returns 'wilting' for tasks overdue by more than 3 days", () => {
      const fiveDaysAgo = new Date();
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
      const dueDateStr = fiveDaysAgo.toISOString().slice(0, 10);

      const tasks = [makeTask({ dueDate: dueDateStr })];
      expect(calculateMood({ plant: makePlant(), tasks })).toBe("wilting");
    });

    it("returns 'happy' when tasks are not overdue", () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dueDateStr = tomorrow.toISOString().slice(0, 10);

      const tasks = [makeTask({ dueDate: dueDateStr })];
      expect(calculateMood({ plant: makePlant(), tasks })).toBe("happy");
    });

    it("returns 'happy' when tasks have no due date", () => {
      const tasks = [makeTask({ dueDate: null })];
      expect(calculateMood({ plant: makePlant(), tasks })).toBe("happy");
    });

    it("picks the most overdue task for wilting threshold", () => {
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      const fiveDaysAgo = new Date();
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

      const tasks = [
        makeTask({ id: 1, dueDate: twoDaysAgo.toISOString().slice(0, 10) }),
        makeTask({ id: 2, dueDate: fiveDaysAgo.toISOString().slice(0, 10) }),
      ];
      expect(calculateMood({ plant: makePlant(), tasks })).toBe("wilting");
    });
  });

  describe("default behavior", () => {
    it("returns 'happy' for healthy established plant with no issues", () => {
      expect(calculateMood({ plant: makePlant() })).toBe("happy");
    });

    it("returns 'happy' when tasks array is empty", () => {
      expect(calculateMood({ plant: makePlant(), tasks: [] })).toBe("happy");
    });
  });

  describe("mood priority", () => {
    it("dormant overrides overdue tasks", () => {
      const fiveDaysAgo = new Date();
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
      const tasks = [makeTask({ dueDate: fiveDaysAgo.toISOString().slice(0, 10) })];

      expect(calculateMood({
        plant: makePlant({ status: "dormant" }),
        tasks,
      })).toBe("sleeping");
    });

    it("weather cold overrides overdue tasks", () => {
      const fiveDaysAgo = new Date();
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
      const tasks = [makeTask({ dueDate: fiveDaysAgo.toISOString().slice(0, 10) })];
      const plant = makePlant({
        plantReference: { minTempF: 40, maxTempF: 100 } as PlantInstance["plantReference"],
      });

      expect(calculateMood({
        plant,
        tasks,
        weather: { temperature: 20 } as Weather,
      })).toBe("cold");
    });
  });
});

// ─── getCurrentSeason ───────────────────────────────────────────────────────

describe("getCurrentSeason", () => {
  it("returns 'spring' for months 2-4 (Mar-May)", () => {
    expect(getCurrentSeason(2)).toBe("spring");
    expect(getCurrentSeason(3)).toBe("spring");
    expect(getCurrentSeason(4)).toBe("spring");
  });

  it("returns 'summer' for months 5-7 (Jun-Aug)", () => {
    expect(getCurrentSeason(5)).toBe("summer");
    expect(getCurrentSeason(6)).toBe("summer");
    expect(getCurrentSeason(7)).toBe("summer");
  });

  it("returns 'fall' for months 8-10 (Sep-Nov)", () => {
    expect(getCurrentSeason(8)).toBe("fall");
    expect(getCurrentSeason(9)).toBe("fall");
    expect(getCurrentSeason(10)).toBe("fall");
  });

  it("returns 'winter' for months 11, 0, 1 (Dec-Feb)", () => {
    expect(getCurrentSeason(11)).toBe("winter");
    expect(getCurrentSeason(0)).toBe("winter");
    expect(getCurrentSeason(1)).toBe("winter");
  });

  it("uses current month when none provided", () => {
    const month = new Date().getMonth();
    const expected =
      month >= 2 && month <= 4 ? "spring" :
      month >= 5 && month <= 7 ? "summer" :
      month >= 8 && month <= 10 ? "fall" : "winter";
    expect(getCurrentSeason()).toBe(expected);
  });
});

// ─── getSeasonalSummary ──────────────────────────────────────────────────────

describe("getSeasonalSummary", () => {
  it("returns early spring message for month 2 (March)", () => {
    const msg = getSeasonalSummary(2);
    expect(msg).toContain("early spring");
  });

  it("returns mid-spring message for month 3 (April)", () => {
    const msg = getSeasonalSummary(3);
    expect(msg).toContain("Mid-spring");
  });

  it("returns late spring message for month 4 (May)", () => {
    const msg = getSeasonalSummary(4);
    expect(msg).toContain("Late spring");
  });

  it("returns early summer message for month 5 (June)", () => {
    const msg = getSeasonalSummary(5);
    expect(msg).toContain("Early summer");
  });

  it("returns peak summer message for month 6 (July)", () => {
    const msg = getSeasonalSummary(6);
    expect(msg).toContain("Peak summer");
  });

  it("returns late summer message for month 7 (August)", () => {
    const msg = getSeasonalSummary(7);
    expect(msg).toContain("Late summer");
  });

  it("returns early fall message for month 8 (September)", () => {
    const msg = getSeasonalSummary(8);
    expect(msg).toContain("Early fall");
  });

  it("returns mid-fall message for month 9 (October)", () => {
    const msg = getSeasonalSummary(9);
    expect(msg).toContain("Mid-fall");
  });

  it("returns late fall message for month 10 (November)", () => {
    const msg = getSeasonalSummary(10);
    expect(msg).toContain("Late fall");
  });

  it("returns early winter message for month 11 (December)", () => {
    const msg = getSeasonalSummary(11);
    expect(msg).toContain("Early winter");
  });

  it("returns mid-winter message for month 0 (January)", () => {
    const msg = getSeasonalSummary(0);
    expect(msg).toContain("Mid-winter");
  });

  it("returns late winter message for month 1 (February)", () => {
    const msg = getSeasonalSummary(1);
    expect(msg).toContain("Late winter");
  });
});

// ─── getFrostInfo ────────────────────────────────────────────────────────────

describe("getFrostInfo", () => {
  it("returns unknown status when no frost dates provided", () => {
    const result = getFrostInfo();
    expect(result.frostStatus).toBe("unknown");
    expect(result.daysSinceLastFrost).toBeNull();
    expect(result.daysUntilFirstFrost).toBeNull();
  });

  it("returns unknown when both are null", () => {
    const result = getFrostInfo(null, null);
    expect(result.frostStatus).toBe("unknown");
  });

  it("calculates days since last frost correctly", () => {
    // Use a date that is clearly in the past this year
    const now = new Date();
    const lastMonth = new Date(now);
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const lastFrostDate = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, "0")}-${String(lastMonth.getDate()).padStart(2, "0")}`;

    const result = getFrostInfo(lastFrostDate);
    expect(result.daysSinceLastFrost).toBeGreaterThan(0);
    expect(result.frostStatus).toBe("growing-season");
  });

  it("returns before-last when last frost is in the future", () => {
    const now = new Date();
    const nextMonth = new Date(now);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const lastFrostDate = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}-${String(nextMonth.getDate()).padStart(2, "0")}`;

    const result = getFrostInfo(lastFrostDate);
    expect(result.daysSinceLastFrost).toBeLessThan(0);
    expect(result.frostStatus).toBe("before-last");
  });

  it("calculates days until first frost", () => {
    const now = new Date();
    const twoMonthsLater = new Date(now);
    twoMonthsLater.setMonth(twoMonthsLater.getMonth() + 2);
    const firstFrostDate = `${twoMonthsLater.getFullYear()}-${String(twoMonthsLater.getMonth() + 1).padStart(2, "0")}-${String(twoMonthsLater.getDate()).padStart(2, "0")}`;

    const result = getFrostInfo(null, firstFrostDate);
    expect(result.daysUntilFirstFrost).toBeGreaterThan(0);
  });

  it("returns after-first when first frost is in the past", () => {
    const now = new Date();
    const lastMonth = new Date(now);
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const firstFrostDate = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, "0")}-${String(lastMonth.getDate()).padStart(2, "0")}`;

    const result = getFrostInfo(null, firstFrostDate);
    expect(result.daysUntilFirstFrost).toBeLessThan(0);
    expect(result.frostStatus).toBe("after-first");
  });
});
