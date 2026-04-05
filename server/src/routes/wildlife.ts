import { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { locations } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { locationIdParamSchema } from "../lib/validation.js";
import { requireAuth } from "../plugins/auth.js";

export interface WildlifeEntry {
  name: string;
  category: "pollinator" | "bird" | "beneficial_insect" | "amphibian" | "reptile";
  activeMonths: number[];
  regions: string[];
  description: string;
  funFact: string;
}

const wildlifeData: WildlifeEntry[] = [
  // ─── Pollinators ────────────────────────────────────────────────────────────
  {
    name: "Honeybee",
    category: "pollinator",
    activeMonths: [3, 4, 5, 6, 7, 8, 9, 10],
    regions: ["3a-10b"],
    description: "Essential garden pollinator. Visits flowers for nectar and pollen, pollinating plants in the process.",
    funFact: "A single honeybee can visit up to 5,000 flowers in a single day.",
  },
  {
    name: "Bumblebee",
    category: "pollinator",
    activeMonths: [3, 4, 5, 6, 7, 8, 9],
    regions: ["3a-9b"],
    description: "Large, fuzzy pollinator that can 'buzz pollinate' — vibrating flowers to release pollen. Critical for tomatoes and blueberries.",
    funFact: "Bumblebees can fly in cooler temperatures and lower light than honeybees, making them early morning pollinators.",
  },
  {
    name: "Monarch Butterfly",
    category: "pollinator",
    activeMonths: [5, 6, 7, 8, 9],
    regions: ["4a-10b"],
    description: "Iconic orange and black butterfly. Caterpillars feed exclusively on milkweed. Important pollinator during migration.",
    funFact: "Monarchs migrate up to 3,000 miles from the US to central Mexico each fall.",
  },
  {
    name: "Swallowtail Butterfly",
    category: "pollinator",
    activeMonths: [4, 5, 6, 7, 8, 9],
    regions: ["4a-10b"],
    description: "Large, colorful butterflies with distinctive tail-like extensions on hindwings. Caterpillars feed on dill, parsley, and fennel.",
    funFact: "Black swallowtail caterpillars can eat an entire parsley plant in a few days — plant extra for them!",
  },
  {
    name: "Luna Moth",
    category: "pollinator",
    activeMonths: [5, 6, 7],
    regions: ["4a-9b"],
    description: "Stunning large green moth with long tail streamers. Nocturnal pollinator attracted to pale, fragrant night-blooming flowers.",
    funFact: "Adult luna moths have no mouths — they live only about a week and don't eat, surviving on energy stored as caterpillars.",
  },
  {
    name: "Mason Bee",
    category: "pollinator",
    activeMonths: [3, 4, 5, 6],
    regions: ["3a-8b"],
    description: "Solitary native bee and superb early-season pollinator. Nests in hollow stems and holes in wood.",
    funFact: "A single mason bee can pollinate as effectively as 100 honeybees for fruit trees.",
  },
  {
    name: "Hummingbird Moth",
    category: "pollinator",
    activeMonths: [5, 6, 7, 8, 9],
    regions: ["4a-10b"],
    description: "Day-flying moth that hovers like a hummingbird while feeding. Visits tubular flowers with its long proboscis.",
    funFact: "Hummingbird moths can fly at speeds up to 12 mph and beat their wings about 70 times per second.",
  },

  // ─── Birds ──────────────────────────────────────────────────────────────────
  {
    name: "Ruby-throated Hummingbird",
    category: "bird",
    activeMonths: [4, 5, 6, 7, 8, 9],
    regions: ["4a-9b"],
    description: "Tiny, iridescent bird that hovers at tubular flowers. Key pollinator for red and orange flowers.",
    funFact: "Hummingbirds can fly backwards and their hearts beat up to 1,200 times per minute.",
  },
  {
    name: "American Goldfinch",
    category: "bird",
    activeMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    regions: ["3a-9b"],
    description: "Bright yellow songbird that feeds on seeds from coneflowers, sunflowers, and other composites.",
    funFact: "Goldfinches are strict vegetarians — one of the few birds that feed their young an all-seed diet.",
  },
  {
    name: "American Robin",
    category: "bird",
    activeMonths: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    regions: ["3a-10b"],
    description: "Familiar garden bird that feeds on earthworms, insects, and berries. Often the first sign of spring.",
    funFact: "Robins can eat up to 14 feet of earthworms in a single day.",
  },
  {
    name: "House Wren",
    category: "bird",
    activeMonths: [4, 5, 6, 7, 8, 9],
    regions: ["4a-9b"],
    description: "Tiny, energetic songbird with a huge voice. Voracious insect eater that helps control garden pests.",
    funFact: "A house wren pair can feed 500 spiders and caterpillars to their nestlings in a single afternoon.",
  },
  {
    name: "Chickadee",
    category: "bird",
    activeMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    regions: ["3a-8b"],
    description: "Cheerful, acrobatic songbird. Year-round garden resident that eats insects, seeds, and berries.",
    funFact: "Chickadees can remember thousands of hiding places where they've stored seeds.",
  },
  {
    name: "Eastern Bluebird",
    category: "bird",
    activeMonths: [3, 4, 5, 6, 7, 8, 9, 10],
    regions: ["4a-9b"],
    description: "Beautiful blue songbird that feeds on insects and berries. Thrives with nest boxes in open gardens.",
    funFact: "Bluebird populations declined 90% in the 20th century but recovered thanks to nest box programs.",
  },

  // ─── Beneficial Insects ──────────────────────────────────────────────────────
  {
    name: "Ladybug",
    category: "beneficial_insect",
    activeMonths: [3, 4, 5, 6, 7, 8, 9, 10],
    regions: ["3a-10b"],
    description: "Voracious aphid predator. A single ladybug can eat up to 5,000 aphids in its lifetime.",
    funFact: "Ladybugs bleed from their knees when threatened, releasing a foul-smelling fluid to deter predators.",
  },
  {
    name: "Praying Mantis",
    category: "beneficial_insect",
    activeMonths: [5, 6, 7, 8, 9, 10],
    regions: ["5a-10b"],
    description: "Large predatory insect that feeds on many garden pests including moths, crickets, and flies.",
    funFact: "Praying mantises are the only insects that can turn their heads 180 degrees.",
  },
  {
    name: "Green Lacewing",
    category: "beneficial_insect",
    activeMonths: [4, 5, 6, 7, 8, 9],
    regions: ["3a-10b"],
    description: "Delicate green insect whose larvae are fierce predators of aphids, mites, and small caterpillars.",
    funFact: "Lacewing larvae are nicknamed 'aphid lions' — a single larva can consume 200 aphids per week.",
  },
  {
    name: "Ground Beetle",
    category: "beneficial_insect",
    activeMonths: [3, 4, 5, 6, 7, 8, 9, 10],
    regions: ["3a-10b"],
    description: "Nocturnal predator that feeds on slugs, snails, cutworms, and other soil-dwelling pests.",
    funFact: "Ground beetles can consume their body weight in pests every day.",
  },
  {
    name: "Hoverfly",
    category: "beneficial_insect",
    activeMonths: [4, 5, 6, 7, 8, 9],
    regions: ["3a-10b"],
    description: "Bee mimic that hovers at flowers. Adults pollinate while larvae eat aphids — double benefit!",
    funFact: "Hoverfly larvae can eat 400 aphids before pupating.",
  },

  // ─── Amphibians & Others ────────────────────────────────────────────────────
  {
    name: "American Toad",
    category: "amphibian",
    activeMonths: [3, 4, 5, 6, 7, 8, 9, 10],
    regions: ["3a-9b"],
    description: "Nocturnal garden helper that eats slugs, beetles, cutworms, and other pests. Prefers moist, shady spots.",
    funFact: "A single toad can eat up to 10,000 insects in a summer — the ultimate organic pest control.",
  },
  {
    name: "Tree Frog",
    category: "amphibian",
    activeMonths: [4, 5, 6, 7, 8, 9],
    regions: ["4a-10b"],
    description: "Small, climbing frog found in garden shrubs and trees. Feeds on mosquitoes, flies, and other small insects.",
    funFact: "Tree frogs have toe pads that work like suction cups, allowing them to climb smooth vertical surfaces.",
  },
  {
    name: "Garden Skink",
    category: "reptile",
    activeMonths: [4, 5, 6, 7, 8, 9, 10],
    regions: ["6a-10b"],
    description: "Small, fast lizard that feeds on spiders, beetles, and other garden insects. Often found under rocks and logs.",
    funFact: "Some skinks can detach their tails when grabbed by a predator — the tail keeps wriggling as a decoy.",
  },
  {
    name: "Garter Snake",
    category: "reptile",
    activeMonths: [4, 5, 6, 7, 8, 9, 10],
    regions: ["3a-9b"],
    description: "Harmless garden snake that feeds on slugs, snails, and small rodents. Beneficial pest controller.",
    funFact: "Garter snakes are one of the few snake species that can tolerate cold climates, found as far north as Alaska.",
  },
];

function getHardinessZoneNumber(zone: string | null): number | null {
  if (!zone) return null;
  const match = zone.match(/(\d+)/);
  return match?.[1] ? parseInt(match[1], 10) : null;
}

function isZoneInRange(zoneNum: number, rangeStr: string): boolean {
  const match = rangeStr.match(/(\d+)[ab]?-(\d+)[ab]?/);
  if (!match?.[1] || !match[2]) return false;
  const min = parseInt(match[1], 10);
  const max = parseInt(match[2], 10);
  return zoneNum >= min && zoneNum <= max;
}

export async function wildlifeRoutes(app: FastifyInstance) {
  // Auth: require login for all routes in this plugin
  app.addHook("onRequest", requireAuth);

  // GET /:locationId - get seasonal wildlife for a location
  app.get<{ Params: { locationId: string } }>(
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

      const currentMonth = new Date().getMonth() + 1; // 1-12
      const zoneNum = getHardinessZoneNumber(location.hardinessZone);

      const filtered = wildlifeData.filter((entry) => {
        const activeNow = entry.activeMonths.includes(currentMonth);
        const inRegion =
          zoneNum === null ||
          entry.regions.some((r) => isZoneInRange(zoneNum, r));
        return activeNow && inRegion;
      });

      return {
        locationId,
        month: currentMonth,
        hardinessZone: location.hardinessZone,
        wildlife: filtered,
        totalSpecies: filtered.length,
      };
    },
  );
}
