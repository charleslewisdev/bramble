/**
 * Seed the Almanac with the Composting Guide that used to be hardcoded in
 * `web/src/pages/almanac/CompostingGuide.tsx`. Idempotent — safe to run more
 * than once.
 *
 * Usage: pnpm --filter server tsx src/db/seed-almanac.ts
 */
import { db } from "./index.js";
import { almanacEntries, almanacEntryTags, almanacTags } from "./schema.js";
import { eq } from "drizzle-orm";

const COMPOSTING_MARKDOWN = `# Composting Guide

Everything you need to know about feeding your soil.

## Compost vs. Fertilizer

**Compost feeds the soil** — it improves structure, water retention, and beneficial microbe populations. Think of it as a long-term investment in soil health.

**Fertilizer feeds the plant** — it delivers targeted NPK (nitrogen, phosphorus, potassium) for immediate uptake. Use it for specific deficiencies or heavy feeders.

Use compost for general soil health, fertilizer for specific deficiencies, and both together for heavy feeders that demand a lot from the soil.

## Compost Types & NPK

| Type             | N     | P       | K     | Notes                                           |
| ---------------- | ----- | ------- | ----- | ----------------------------------------------- |
| Finished compost | 1-3   | 0.5-2   | 1-2   | Varies by inputs; 10-30% N available year one   |
| Worm castings    | ~1    | ~0      | ~0    | Exceptional for beneficial microbes             |
| Rabbit manure    | 2.4   | 1.4     | 0.6   | Cold manure — safe for direct application       |
| Chicken manure   | 1.1   | 0.8     | 0.5   | Hot manure — must compost first                 |
| Horse manure     | 0.5   | 0.3     | 0.4   | Hot — often contains weed seeds                 |
| Mushroom compost | 0.7   | 0.3     | 0.3   | Tends alkaline                                  |

## Rabbit Poop Compost

Rabbit manure has an NPK of \`2.4-1.4-0.6\` and is classified as "cold" manure, meaning it can go directly on garden beds without composting first. This makes it one of the most convenient organic amendments available.

Use it year-round: as a nitrogen boost in spring, a side dressing during summer growing season, and for soil replenishment in fall. Scatter pellets around plants but don't let them touch stems directly.

If you prefer to compost it first, rabbit manure breaks down fully in 30-45 days. This can reduce any residual odor and create a more uniform amendment.

> **Caution:** Excess nitrogen can fork root crops (carrots, radishes) and promote leaf growth over blooms in flowering plants. Use sparingly around these crops.

## Compost Tea

Two primary brewing methods:

### Aerated

- Air pump + air stones in a bucket
- Brew for 24-48 hours
- Must use within 4 hours of finishing

### Non-aerated

- Compost in a bucket of water
- Steep for 3-5 days, stir occasionally
- Simpler setup, longer brew time

Compost tea has negligible NPK (roughly \`0.07-0.02-0.05\`). Its primary value is delivering beneficial microbes to the soil. Apply as a soil drench or filtered foliar spray every 2-4 weeks during the growing season.

> **Note:** Scientific evidence for compost tea's disease suppression benefits is mixed. It's generally considered beneficial but not a substitute for good soil management practices.

## Tea vs. Extract vs. Liquid Fertilizer

|             | Compost Tea         | Compost Extract     | Liquid Fertilizer |
| ----------- | ------------------- | ------------------- | ----------------- |
| Goal        | Breed microbes      | Extract nutrients   | Deliver NPK       |
| Method      | Aerated 24-48hrs    | Soaked 1-4hrs       | Buy ready-made    |
| NPK         | Negligible          | Low                 | Moderate-high     |
| Shelf life  | Use within 4hrs     | Use within 48hrs    | Weeks-months      |
| Equipment   | Air pump, bucket    | Bucket only         | None              |

## Application Methods

### Topdressing

Spread compost on the soil surface. Preferred method — preserves soil structure and lets worms and rain work it in naturally.

### Tilling In

Mix compost into the top 4-6 inches of soil. Best for new beds or severely compacted soil that needs structural improvement.

Apply 1-2 inches of compost annually for garden beds, either in fall (to break down over winter) or early spring (before planting season). Do not exceed 2 inches per year to avoid nutrient imbalances.

## Which Plants Love Compost

### Heavy Feeders

These plants thrive with generous compost applications: tomatoes, peppers, corn, squash, roses, hydrangeas, and dahlias. They benefit from both the nutrients and improved soil structure that compost provides.

### Be Careful With

- **Succulents and cacti** — compost retains too much moisture for drought-adapted plants
- **Mediterranean herbs** (lavender, rosemary) — prefer lean, well-drained soil
- **Blueberries** — prefer acidic conditions; compost tends neutral to alkaline
- **Legumes** (beans, peas) — fix their own nitrogen; extra N is wasted
- **Root crops** (carrots, radishes) — excess nitrogen causes forking and branching
`;

const SEED_ENTRIES: Array<{
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  tags: string[];
}> = [
  {
    slug: "composting-guide",
    title: "Composting Guide",
    excerpt:
      "Compost types, NPK ratios, rabbit manure, compost tea, and application methods.",
    content: COMPOSTING_MARKDOWN,
    tags: ["composting", "soil"],
  },
];

function upsertTags(names: string[]): number[] {
  const ids: number[] = [];
  for (const name of names) {
    const existing = db
      .select({ id: almanacTags.id })
      .from(almanacTags)
      .where(eq(almanacTags.name, name))
      .get();
    if (existing) {
      ids.push(existing.id);
    } else {
      const inserted = db
        .insert(almanacTags)
        .values({ name })
        .returning({ id: almanacTags.id })
        .get();
      ids.push(inserted.id);
    }
  }
  return ids;
}

async function seedAlmanac() {
  let inserted = 0;
  let skipped = 0;

  for (const entry of SEED_ENTRIES) {
    const existing = db
      .select({ id: almanacEntries.id })
      .from(almanacEntries)
      .where(eq(almanacEntries.slug, entry.slug))
      .get();

    if (existing) {
      skipped++;
      continue;
    }

    const row = db
      .insert(almanacEntries)
      .values({
        slug: entry.slug,
        title: entry.title,
        excerpt: entry.excerpt,
        content: entry.content,
      })
      .returning({ id: almanacEntries.id })
      .get();

    const tagIds = upsertTags(entry.tags);
    for (const tagId of tagIds) {
      db.insert(almanacEntryTags).values({ entryId: row.id, tagId }).run();
    }

    inserted++;
  }

  console.log(
    `Almanac seed: inserted ${inserted}, skipped ${skipped} already-present entries.`,
  );
}

seedAlmanac().catch((err) => {
  console.error(err);
  process.exit(1);
});
