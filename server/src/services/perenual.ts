/**
 * Perenual Plant API integration
 * https://perenual.com/docs/api
 *
 * Free tier: 100 requests/day, species data for IDs 1-3000
 * Used for on-demand plant search — results cached locally in plantReferences
 */

import { db } from "../db/index.js";
import { plantReferences } from "../db/schema.js";
import { eq } from "drizzle-orm";

const BASE_URL = "https://perenual.com/api";

// ─── Types ───────────────────────────────────────────────────────────────────

interface PerenualSearchResult {
  id: number;
  common_name: string;
  scientific_name: string[];
  other_name: string[];
  cycle: string; // "Perennial", "Annual", "Biennial"
  watering: string; // "Average", "Minimum", "Frequent", "None"
  sunlight: string[]; // ["full sun", "part shade"]
  default_image?: {
    license: number;
    license_name: string;
    license_url: string;
    original_url: string;
    regular_url: string;
    medium_url: string;
    small_url: string;
    thumbnail: string;
  };
}

interface PerenualSearchResponse {
  data: PerenualSearchResult[];
  to: number;
  per_page: number;
  current_page: number;
  from: number;
  last_page: number;
  total: number;
}

interface PerenualPlantDetail {
  id: number;
  common_name: string;
  scientific_name: string[];
  other_name: string[];
  family: string | null;
  origin: string[] | null;
  type: string; // "Flower", "Tree", "Shrub", etc.
  dimension: string;
  dimensions: {
    type: string | null;
    min_value: number;
    max_value: number;
    unit: string;
  };
  cycle: string;
  attracts: string[] | null; // ["Butterflies", "Hummingbirds"]
  propagation: string[];
  hardiness: {
    min: string; // "6"
    max: string; // "9"
  };
  hardiness_location?: {
    full_url: string;
    full_iframe: string;
  };
  watering: string;
  depth_water_requirement: unknown;
  volume_water_requirement: unknown;
  watering_period: string | null;
  watering_general_benchmark: {
    value: string | null;
    unit: string | null;
  };
  sunlight: string[];
  pruning_month: string[];
  pruning_count: unknown;
  seeds: number;
  maintenance: string | null; // "Low", "Moderate", "High"
  care_guides: string;
  soil: string[];
  growth_rate: string; // "Low", "Moderate", "High"
  drought_tolerant: boolean;
  salt_tolerant: boolean;
  thorny: boolean;
  invasive: boolean;
  tropical: boolean;
  indoor: boolean;
  care_level: string; // "Low", "Moderate", "High"
  flowers: boolean;
  flowering_season: string | null;
  flower_color: string;
  cones: boolean;
  fruits: boolean;
  fruiting_season: string | null;
  fruit_color: string[];
  harvest_season: string | null;
  leaf: boolean;
  leaf_color: string[];
  edible_leaf: boolean;
  cuisine: boolean;
  medicinal: boolean;
  poisonous_to_humans: number; // 0 or 1
  poisonous_to_pets: number; // 0 or 1
  description: string;
  default_image?: {
    license: number;
    license_name: string;
    license_url: string;
    original_url: string;
    regular_url: string;
    medium_url: string;
    small_url: string;
    thumbnail: string;
  };
}

// ─── Mappers ─────────────────────────────────────────────────────────────────

function mapCycleToLifecycle(
  cycle: string,
): "annual" | "biennial" | "perennial" | "tender_perennial" | null {
  switch (cycle?.toLowerCase()) {
    case "annual":
      return "annual";
    case "biennial":
      return "biennial";
    case "perennial":
      return "perennial";
    case "tender perennial":
      return "tender_perennial";
    default:
      return null;
  }
}

function mapWatering(
  watering: string,
): "low" | "moderate" | "high" | "aquatic" | null {
  switch (watering?.toLowerCase()) {
    case "minimum":
    case "none":
      return "low";
    case "average":
      return "moderate";
    case "frequent":
      return "high";
    default:
      return null;
  }
}

function mapSunlight(
  sunlight: string[],
): "full_sun" | "partial_sun" | "partial_shade" | "full_shade" | null {
  if (!sunlight?.length) return null;
  const first = sunlight[0];
  if (!first) return null;
  const primary = first.toLowerCase();
  if (primary.includes("full sun")) return "full_sun";
  if (primary.includes("part sun")) return "partial_sun";
  if (primary.includes("part shade") || primary.includes("filtered"))
    return "partial_shade";
  if (primary.includes("full shade") || primary.includes("deep shade"))
    return "full_shade";
  return "partial_sun";
}

function mapGrowthRate(
  rate: string,
): "slow" | "moderate" | "fast" | null {
  switch (rate?.toLowerCase()) {
    case "low":
    case "slow":
      return "slow";
    case "moderate":
    case "medium":
      return "moderate";
    case "high":
    case "fast":
      return "fast";
    default:
      return null;
  }
}

function mapPlantType(
  type: string,
):
  | "flower"
  | "shrub"
  | "tree"
  | "herb"
  | "grass"
  | "fern"
  | "succulent"
  | "cactus"
  | "vine"
  | "vegetable"
  | "fruit"
  | "houseplant"
  | "groundcover"
  | "bulb"
  | null {
  switch (type?.toLowerCase()) {
    case "flower":
      return "flower";
    case "tree":
      return "tree";
    case "shrub":
    case "bush":
      return "shrub";
    case "herb":
      return "herb";
    case "grass":
    case "ornamental grass":
      return "grass";
    case "fern":
      return "fern";
    case "succulent":
      return "succulent";
    case "cactus":
      return "cactus";
    case "vine":
    case "climber":
    case "creeper":
      return "vine";
    case "vegetable":
      return "vegetable";
    case "fruit":
      return "fruit";
    case "bulb":
      return "bulb";
    case "ground cover":
    case "groundcover":
      return "groundcover";
    case "indoor plant":
    case "houseplant":
      return "houseplant";
    default:
      return "flower";
  }
}

function mapSpriteType(
  plantType: string | null,
):
  | "flower"
  | "shrub"
  | "tree"
  | "herb"
  | "fern"
  | "succulent"
  | "cactus"
  | "vine"
  | "grass"
  | "bulb"
  | "vegetable"
  | "fruit" {
  switch (plantType) {
    case "shrub":
      return "shrub";
    case "tree":
      return "tree";
    case "herb":
      return "herb";
    case "fern":
      return "fern";
    case "succulent":
      return "succulent";
    case "cactus":
      return "cactus";
    case "vine":
      return "vine";
    case "grass":
      return "grass";
    case "bulb":
      return "bulb";
    case "vegetable":
      return "vegetable";
    case "fruit":
      return "fruit";
    default:
      return "flower";
  }
}

// ─── API Functions ───────────────────────────────────────────────────────────

function getApiKey(): string | null {
  return process.env.PERENUAL_API_KEY ?? null;
}

/**
 * Search plants via Perenual API
 * Returns transformed results ready for display
 */
export async function searchPerenualPlants(
  query: string,
  page: number = 1,
): Promise<{
  results: PerenualSearchResult[];
  total: number;
  page: number;
  lastPage: number;
} | null> {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  const params = new URLSearchParams({
    key: apiKey,
    q: query,
    page: String(page),
  });

  const response = await fetch(
    `${BASE_URL}/species-list?${params}`,
    { signal: AbortSignal.timeout(10000) },
  );

  if (!response.ok) {
    if (response.status === 429) {
      console.warn("Perenual API rate limit reached (100/day)");
      return null;
    }
    throw new Error(`Perenual API error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as PerenualSearchResponse;

  return {
    results: data.data,
    total: data.total,
    page: data.current_page,
    lastPage: data.last_page,
  };
}

/**
 * Get detailed plant info from Perenual and cache it as a plantReference
 * Returns the local DB record (existing or newly created)
 */
export async function getPerenualPlantDetail(
  perenualId: number,
): Promise<typeof plantReferences.$inferSelect | null> {
  // Check if already cached locally
  const existing = await db.query.plantReferences.findFirst({
    where: eq(plantReferences.externalId, `perenual:${perenualId}`),
  });
  if (existing) return existing;

  const apiKey = getApiKey();
  if (!apiKey) return null;

  const params = new URLSearchParams({ key: apiKey });
  const response = await fetch(
    `${BASE_URL}/species/details/${perenualId}?${params}`,
    { signal: AbortSignal.timeout(10000) },
  );

  if (!response.ok) {
    if (response.status === 429) {
      console.warn("Perenual API rate limit reached");
      return null;
    }
    throw new Error(`Perenual API error: ${response.status}`);
  }

  const plant = (await response.json()) as PerenualPlantDetail;
  const plantType = mapPlantType(plant.type);

  // Transform and insert into local DB
  const record = db
    .insert(plantReferences)
    .values({
      commonName: plant.common_name,
      latinName: plant.scientific_name?.[0] ?? null,
      family: plant.family,
      plantType,
      sunRequirement: mapSunlight(plant.sunlight),
      waterNeeds: mapWatering(plant.watering),
      soilPreference: plant.soil?.join(", ") || null,
      hardinessZoneMin: plant.hardiness?.min
        ? parseInt(plant.hardiness.min, 10)
        : null,
      hardinessZoneMax: plant.hardiness?.max
        ? parseInt(plant.hardiness.max, 10)
        : null,
      matureHeight: plant.dimension || null,
      growthRate: mapGrowthRate(plant.growth_rate),
      bloomTime: plant.flowering_season || null,
      bloomColor: plant.flower_color || null,
      foliageType: null,
      lifecycle: mapCycleToLifecycle(plant.cycle),
      nativeRegion: plant.origin?.join(", ") || null,
      deerResistant: null, // Not available from Perenual
      droughtTolerant: plant.drought_tolerant ?? false,
      containerSuitable: plant.indoor ?? null,
      attractsPollinators:
        plant.attracts?.some((a) =>
          ["Bees", "Butterflies", "Pollinators"].some((p) =>
            a.toLowerCase().includes(p.toLowerCase()),
          ),
        ) ?? false,
      attractsBirds:
        plant.attracts?.some((a) =>
          a.toLowerCase().includes("bird") ||
          a.toLowerCase().includes("hummingbird"),
        ) ?? false,
      attractsButterflies:
        plant.attracts?.some((a) =>
          a.toLowerCase().includes("butterfl"),
        ) ?? false,
      toxicityDogs: plant.poisonous_to_pets ? "toxic" : "safe",
      toxicityCats: plant.poisonous_to_pets ? "toxic" : "safe",
      toxicityChildren: plant.poisonous_to_humans ? "toxic" : "safe",
      spriteType: mapSpriteType(plantType),
      description: plant.description || null,
      careNotes: [
        plant.maintenance ? `Maintenance: ${plant.maintenance}` : null,
        plant.care_level ? `Care level: ${plant.care_level}` : null,
        plant.watering_period
          ? `Watering period: ${plant.watering_period}`
          : null,
      ]
        .filter(Boolean)
        .join(". ") || null,
      pruningNotes: plant.pruning_month?.length
        ? `Prune in: ${plant.pruning_month.join(", ")}`
        : null,
      source: "perenual",
      externalId: `perenual:${perenualId}`,
    })
    .returning()
    .get();

  return record;
}

/**
 * Search for plants — checks local DB first, then falls back to Perenual API.
 * Returns combined results with source indicator.
 */
export interface PlantSearchResult {
  source: "local" | "perenual";
  localId?: number;
  perenualId?: number;
  commonName: string;
  latinName?: string | null;
  plantType?: string | null;
  sunlight?: string[];
  watering?: string;
  cycle?: string;
  imageUrl?: string | null;
}

export function mapPerenualToSearchResult(
  plant: PerenualSearchResult,
): PlantSearchResult {
  return {
    source: "perenual",
    perenualId: plant.id,
    commonName: plant.common_name,
    latinName: plant.scientific_name?.[0],
    plantType: null,
    sunlight: plant.sunlight,
    watering: plant.watering,
    cycle: plant.cycle,
    imageUrl: plant.default_image?.thumbnail ?? null,
  };
}
