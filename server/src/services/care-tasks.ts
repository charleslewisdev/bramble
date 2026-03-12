import type {
  PlantInstance,
  PlantReference,
  Zone,
  NewCareTask,
} from "../db/schema.js";

// ─── Bloom month parser ─────────────────────────────────────────────────────

const MONTH_MAP: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function parseMonthMentions(text: string): number[] {
  const lower = text.toLowerCase();
  const months: number[] = [];
  for (const [name, num] of Object.entries(MONTH_MAP)) {
    if (lower.includes(name)) {
      if (!months.includes(num)) months.push(num);
    }
  }
  return months.sort((a, b) => a - b);
}

function parseBloomStartMonth(bloomTime: string): number | null {
  const lower = bloomTime.toLowerCase().trim();
  // Try "March-May" or "March to May" or just "March"
  const first = lower.split(/[-–\s]+/)[0];
  if (!first) return null;
  return MONTH_MAP[first] ?? null;
}

function addDaysToDate(date: Date, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0]!;
}

function nextDateForMonth(month: number, day: number = 1): string {
  const today = new Date();
  let year = today.getFullYear();
  const target = new Date(year, month - 1, day);
  if (target < today) {
    target.setFullYear(year + 1);
  }
  return target.toISOString().split("T")[0]!;
}

// ─── Season helpers ──────────────────────────────────────────────────────────

/** Growing season months (March through October) */
const GROWING_SEASON = [3, 4, 5, 6, 7, 8, 9, 10];

/** Dormant winter months for outdoor deciduous plants */
const DORMANT_MONTHS = [11, 12, 1, 2];

/** All 12 months */
const ALL_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

function isIndoorOrEvergreen(plantRef: PlantReference, zone?: Zone | null): boolean {
  if (zone?.exposure === "indoor" || zone?.exposure === "greenhouse") return true;
  if (plantRef.foliageType === "evergreen" || plantRef.foliageType === "semi-evergreen") return true;
  return false;
}

// ─── Cute first-person messages ─────────────────────────────────────────────

const WATER_MESSAGES = [
  "I'm getting a little parched over here!",
  "Could really use a drink today!",
  "My soil is looking pretty dry...",
  "A nice soak would make my day!",
];

const PRUNE_MESSAGES = [
  "I could use a little trim!",
  "Feeling a bit shaggy, time for a haircut!",
  "Help me stay tidy with a trim?",
];

const FERTILIZE_MESSAGES = [
  "I'm hungry! Time for some plant food!",
  "A little fertilizer would really boost my energy!",
  "Feed me and watch me grow!",
];

const INSPECT_MESSAGES = [
  "Time for a check-up! Take a photo and note how I'm looking.",
  "How am I doing? Snap a pic and let's see!",
  "Monthly check-in time! I'd love a photo update.",
];

const REPOT_MESSAGES = [
  "I'm feeling a little cramped in here! Time for a bigger pot?",
  "My roots are getting cozy — maybe too cozy! Repot me?",
  "I could really stretch out in a new pot!",
  "Home upgrade time! A fresh pot would be amazing.",
];

const PROTECT_MESSAGES = [
  "Brrr! Winter is coming — help me get ready!",
  "Time to bundle up! I need some frost protection.",
  "Could you tuck me in for the cold months?",
  "Winter prep time! Let's make sure I'm cozy.",
];

const PLANTING_MESSAGES = [
  "I'm ready to put down roots! Plant me!",
  "It's time to find me a home in the garden!",
  "Let's get me in the ground — I can't wait to grow!",
];

function randomMessage(messages: string[]): string {
  return messages[Math.floor(Math.random() * messages.length)] ?? messages[0]!;
}

// ─── Options for the generator ───────────────────────────────────────────────

export interface GenerateOptions {
  existingTaskTypes?: string[];
  zone?: Zone | null;
}

// ─── Main generator ─────────────────────────────────────────────────────────

export function generateDefaultCareTasks(
  plantInstance: PlantInstance,
  plantRef: PlantReference,
  options: GenerateOptions = {},
): NewCareTask[] {
  const tasks: NewCareTask[] = [];

  // Don't generate tasks for plants that aren't alive/planted
  const SKIP_STATUSES = new Set(["dead", "removed"]);
  if (SKIP_STATUSES.has(plantInstance.status)) {
    return [];
  }

  const today = new Date();
  const plantName = plantInstance.nickname ?? plantRef.commonName;
  const existingTypes = new Set(options.existingTaskTypes ?? []);
  const zone = options.zone ?? null;

  // ── Water tasks based on waterNeeds ────────────────────────────────────────
  if (!existingTypes.has("water")) {
    const waterNeeds = plantRef.waterNeeds;
    if (waterNeeds) {
      let intervalDays: number;
      switch (waterNeeds) {
        case "high":
          intervalDays = 3;
          break;
        case "moderate":
          intervalDays = 6;
          break;
        case "low":
          intervalDays = 12;
          break;
        default:
          intervalDays = 7;
      }

      // Adjust for zone conditions
      if (zone) {
        if (zone.exposure === "indoor" || zone.exposure === "greenhouse" || zone.moistureLevel === "moist" || zone.moistureLevel === "wet") {
          // Less frequent watering for indoor/moist
          intervalDays = Math.round(intervalDays * 1.3);
        } else if (zone.sunExposure === "full_sun" && (zone.moistureLevel === "dry")) {
          // More frequent for full sun + dry soil
          intervalDays = Math.round(intervalDays * 0.7);
        }
      }

      // Active months: skip dormant winter for outdoor deciduous
      const waterActiveMonths = isIndoorOrEvergreen(plantRef, zone) ? ALL_MONTHS : GROWING_SEASON;

      tasks.push({
        plantInstanceId: plantInstance.id,
        taskType: "water",
        title: `Water ${plantName}`,
        description: `${plantName} has ${waterNeeds} water needs — water every ${intervalDays} days.`,
        dueDate: addDaysToDate(today, intervalDays),
        isRecurring: true,
        intervalDays,
        activeMonths: waterActiveMonths,
        sendNotification: true,
        plantMessage: randomMessage(WATER_MESSAGES),
      });
    }
  }

  // ── Pruning task ──────────────────────────────────────────────────────────
  if (!existingTypes.has("prune") && plantRef.pruningNotes) {
    // Try to parse month mentions from pruning notes
    const mentionedMonths = parseMonthMentions(plantRef.pruningNotes);
    let pruneActiveMonths: number[];
    let pruneDueDate: string;

    if (mentionedMonths.length > 0) {
      pruneActiveMonths = mentionedMonths;
      pruneDueDate = nextDateForMonth(mentionedMonths[0]!);
    } else if (plantRef.foliageType === "deciduous") {
      // Default: late winter for deciduous
      pruneActiveMonths = [2, 3];
      pruneDueDate = nextDateForMonth(2);
    } else if (plantRef.bloomTime) {
      // After bloom for flowering shrubs
      const bloomStart = parseBloomStartMonth(plantRef.bloomTime);
      if (bloomStart !== null) {
        const afterBloom = ((bloomStart + 1) % 12) || 12;
        pruneActiveMonths = [afterBloom, ((afterBloom) % 12) + 1];
        pruneDueDate = nextDateForMonth(afterBloom);
      } else {
        pruneActiveMonths = [2, 3];
        pruneDueDate = nextDateForMonth(2);
      }
    } else {
      pruneActiveMonths = [2, 3];
      pruneDueDate = nextDateForMonth(2);
    }

    tasks.push({
      plantInstanceId: plantInstance.id,
      taskType: "prune",
      title: `Prune ${plantName}`,
      description: plantRef.pruningNotes,
      dueDate: pruneDueDate,
      isRecurring: true,
      intervalDays: 365,
      activeMonths: pruneActiveMonths,
      sendNotification: true,
      plantMessage: randomMessage(PRUNE_MESSAGES),
    });
  }

  // ── Fertilize before bloom ────────────────────────────────────────────────
  if (!existingTypes.has("fertilize") && plantRef.bloomTime) {
    const bloomMonth = parseBloomStartMonth(plantRef.bloomTime);
    if (bloomMonth !== null) {
      // Set fertilize date to ~3 weeks before bloom start
      let fertYear = today.getFullYear();
      const fertDate = new Date(fertYear, bloomMonth - 1, 1);
      fertDate.setDate(fertDate.getDate() - 21); // 3 weeks before bloom

      if (fertDate < today) {
        fertDate.setFullYear(fertDate.getFullYear() + 1);
      }

      tasks.push({
        plantInstanceId: plantInstance.id,
        taskType: "fertilize",
        title: `Fertilize ${plantName} before bloom`,
        description: `${plantName} blooms in ${plantRef.bloomTime}. Fertilize 2-4 weeks before for best results.`,
        dueDate: fertDate.toISOString().split("T")[0]!,
        isRecurring: true,
        intervalDays: 365,
        activeMonths: GROWING_SEASON,
        sendNotification: true,
        plantMessage: randomMessage(FERTILIZE_MESSAGES),
      });
    }
  }

  // ── Repot task for container plants ────────────────────────────────────────
  if (!existingTypes.has("repot") && plantInstance.isContainer) {
    tasks.push({
      plantInstanceId: plantInstance.id,
      taskType: "repot",
      title: `Repot ${plantName}`,
      description: `${plantName} is in a container — repot every 1-2 years in early spring for best results.`,
      dueDate: nextDateForMonth(3), // March
      isRecurring: true,
      intervalDays: 540, // ~1.5 years
      activeMonths: [3, 4],
      sendNotification: true,
      plantMessage: randomMessage(REPOT_MESSAGES),
    });
  }

  // ── Overwintering/protect task ─────────────────────────────────────────────
  if (!existingTypes.has("protect") && plantRef.overwinteringNotes) {
    tasks.push({
      plantInstanceId: plantInstance.id,
      taskType: "protect",
      title: `Winter protection for ${plantName}`,
      description: plantRef.overwinteringNotes,
      dueDate: nextDateForMonth(10), // October
      isRecurring: true,
      intervalDays: 365,
      activeMonths: [10, 11],
      sendNotification: true,
      plantMessage: randomMessage(PROTECT_MESSAGES),
    });
  }

  // ── Initial planting task ──────────────────────────────────────────────────
  if (!existingTypes.has("custom") && plantRef.plantingNotes && plantInstance.status === "planned") {
    tasks.push({
      plantInstanceId: plantInstance.id,
      taskType: "custom",
      title: `Plant ${plantName}`,
      description: plantRef.plantingNotes,
      dueDate: nextDateForMonth(4), // April — spring planting
      isRecurring: false,
      sendNotification: true,
      plantMessage: randomMessage(PLANTING_MESSAGES),
    });
  }

  // ── Health check/inspect task ──────────────────────────────────────────────
  if (!existingTypes.has("inspect")) {
    tasks.push({
      plantInstanceId: plantInstance.id,
      taskType: "inspect",
      title: `Monthly check-up for ${plantName}`,
      description: `Time for a check-up! Take a photo and note how ${plantName} is looking.`,
      dueDate: addDaysToDate(today, 30),
      isRecurring: true,
      intervalDays: 30,
      activeMonths: GROWING_SEASON,
      sendNotification: true,
      plantMessage: randomMessage(INSPECT_MESSAGES),
    });
  }

  return tasks;
}
