import { describe, it, expect } from "vitest";
import { generateDefaultCareTasks } from "./care-tasks.js";
import type { PlantInstance, PlantReference } from "../db/schema.js";

describe("generateDefaultCareTasks", () => {
  const basePlant: PlantInstance = {
    id: 1,
    plantReferenceId: 1,
    zoneId: 1,
    nickname: "Test Plant",
    status: "established",
    isContainer: false,
    mood: "happy",
    containerDescription: null,
    datePlanted: "2025-01-01",
    dateRemoved: null,
    notes: null,
    spriteOverride: null,
    notifyWater: null,
    notifyFertilize: null,
    notifyPrune: null,
    notifyRepot: null,
    notifyInspect: null,
    notifyProtect: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const baseRef: PlantReference = {
    id: 1,
    commonName: "Test Flower",
    latinName: null,
    cultivar: null,
    family: null,
    plantType: "flower",
    sunRequirement: "full_sun",
    waterNeeds: "moderate",
    soilPreference: null,
    hardinessZoneMin: null,
    hardinessZoneMax: null,
    matureHeight: null,
    matureSpread: null,
    growthRate: null,
    bloomTime: null,
    bloomColor: null,
    foliageType: "deciduous",
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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it("generates tasks for established plants", () => {
    const tasks = generateDefaultCareTasks(basePlant, baseRef);
    expect(tasks.length).toBeGreaterThan(0);
    // Should at least have water and inspect tasks
    const taskTypes = tasks.map((t) => t.taskType);
    expect(taskTypes).toContain("water");
    expect(taskTypes).toContain("inspect");
  });

  it("returns empty array for dead plants", () => {
    const tasks = generateDefaultCareTasks(
      { ...basePlant, status: "dead" },
      baseRef,
    );
    expect(tasks).toEqual([]);
  });

  it("returns empty array for removed plants", () => {
    const tasks = generateDefaultCareTasks(
      { ...basePlant, status: "removed" },
      baseRef,
    );
    expect(tasks).toEqual([]);
  });

  it("still generates tasks for planned plants", () => {
    const tasks = generateDefaultCareTasks(
      { ...basePlant, status: "planned" },
      baseRef,
    );
    expect(tasks.length).toBeGreaterThan(0);
  });

  it("generates water task with correct interval for moderate needs", () => {
    const tasks = generateDefaultCareTasks(basePlant, baseRef);
    const waterTask = tasks.find((t) => t.taskType === "water");
    expect(waterTask).toBeDefined();
    expect(waterTask!.intervalDays).toBe(6);
    expect(waterTask!.isRecurring).toBe(true);
  });

  it("skips water task when already exists", () => {
    const tasks = generateDefaultCareTasks(basePlant, baseRef, {
      existingTaskTypes: ["water"],
    });
    const waterTask = tasks.find((t) => t.taskType === "water");
    expect(waterTask).toBeUndefined();
  });
});
