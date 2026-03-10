# Reference Data from Garden Planning Sessions

Source files extracted from `garden-project-resources.zip` (Claude chat session exports).

These files represent the kinds of data Bramble needs to manage natively. They serve as both seed data for the developer's garden and as requirements documentation for the data model.

> **Note:** The original source data files reflect earlier planning iterations. Key decisions have since been finalized — see [Current Decisions](#current-decisions-spring-2026) below. The discussion guide (`garden-discussion-guide.html`) is the most up-to-date consolidated reference.

## Current Decisions (Spring 2026)

Finalized after discussion with partner. These supersede conflicting info in source files.

### Locked In
- **Front yard: LOCKED** — Fothergilla 'Mt. Airy' replaces pampas grass; Hosta 'Sum and Substance' approved
- **Fruiting tree: NONE** — neither fig nor pear. Fothergilla 'Mt. Airy' stands alone as the front bed statement plant. FruitingTree_Comparison.docx is historical only.
- **Blue ceramic containers (x2)**: Both on slab together in full sun — **Agapanthus** with **Creeping Jenny** trailing filler (Cannas Tropicanna/Tropicanna Black are OUT)
- **Lawn conversion**: Fleur de Lawn clover mix — approved
- **Hydrangeas**: Keeping, controlling access to north side yard
- **Dead azalea**: Replaced by Sweet Woodruff groundcover
- **Pergola canopy**: Clematis one side, Honeysuckle 'Serotina' (returning) covers the other half. No hops or grape.
- **Allium bulbs**: Go, fall planting (timing TBD)
- **Aloe vera + Bay laurel**: Moving outside to seating area under gazebo; bay laurel near southern edge for sun access
- **Bog garden**: Personal project, omitted from shared planning — location undecided
- **Budget target**: ~$1,000

### Key Changes from Source Data
| Source Data Says | Current Decision |
|---|---|
| Cannas in blue ceramics (visual triangle) | Agapanthus + Creeping Jenny in ceramics, both on slab |
| Fig vs Pear comparison | Neither — no fruiting tree planned |
| Budget ~$1,334 | Target ~$1,000 |
| Container Bed 2 "mostly empty" | Now pollinator garden (Salvia, Agastache, Echinacea, Alyssum) |

## Files

### PlantInventory_123GardenSt.xlsx
Comprehensive plant inventory with 6 sheets:
- **Plant Inventory** (62 plants) — ID, common/latin name, cultivar, zone/location, potted/in-ground, status, sun/water needs, bloom time/color, mature size, dog/baby safety, drip priority, pruning notes, fertilizer, overwintering, care notes
- **Care Calendar** — Monthly tasks by zone (Jan-Dec)
- **Toxicity Reference** — Dog + baby safety ratings for all plants, organized by risk level (high/caution/safe)
- **Budget** — Itemized budget with vendor contacts, phone numbers, hours, pricing ($1,334 total)
- **Shopping List** — Phased (Phase 1: now, Phase 2: April-May, Fall) with checkboxes, vendor-grouped

### OurPlants.xlsx
Dashboard-style tracker with 6 sheets:
- **Dashboard** — Counts (41 plants total: 26 in-ground, 10 outdoor containers, 5 indoor), bloom calendar overview, toxicity flags, urgent tasks, pollinator plants, care reminders
- **In-Ground Plants** (26 entries) — Emoji-coded light/water/fertilizer/frost, with status and detailed notes
- **Outdoor Containers** (10 entries)
- **Indoor Plants** (5 entries)
- **Legend** — Icon key for all emoji codes used

### yard_map.html
Interactive SVG yard map with:
- Full property layout (~3,500 sqft lot)
- Every garden zone as hoverable SVG elements with data attributes
- Plant lists and care notes per zone
- Compass orientation, legend, zone color coding
- Zones: street-side bed, N driveway bed, blueberry bed, N/S side yards, pavilion, container beds 1+2, cement slab, pergola bed, river rock area (future lawn), SW corner bed, west fence planting zone, arborvitae screen, rosemary bonsai

### yard_plan_presentation.html
Full 2026 yard plan presentation covering:
- Statement container plantings (aqua ceramic trio with visual triangle strategy)
- New perennial additions per bed
- Structural plants (Fothergilla replacing Asian pear plan)
- Action plan with timeline
- Budget breakdown by vendor

### patio_container_map.html
Detailed patio/container zone layout:
- All container placements with specific plants
- Strawberry tower, basil, cilantro, bog garden, bird bowl
- Visual triangle concept (apricot → Ceramic A → Ceramic B)
- TBD items and action items

### bog_garden.html
Carnivorous plant bog garden concept:
- Three-tier cedar tower design
- Plant selection: Sarracenia, Darlingtonia, Drosera, Andromeda
- Materials list, rain collection strategy
- Placement recommendations

### garden-discussion-guide.html
Self-contained 2MB HTML discussion guide (created March 2026):
- Magazine/lookbook-style presentation of the full garden plan
- 17 embedded plant photos (base64, no external dependencies)
- Interactive yard map and patio container map with hover tooltips
- Zone-by-zone tour with plant cards and decision callouts
- Lawn conversion diagram with walkway concept
- Safety/toxicity summary, budget (~$1,000), seasonal timeline
- Print-friendly CSS for PDF export
- **This is the most current consolidated reference for the garden plan**

### FruitingTree_Comparison.docx
*(Historical — neither fig nor pear is part of the current plan)*
Desert King Fig vs Asian Pear 'Hosui' comparison table:
- Visual character, maintenance, detritus, pest/disease
- PNW suitability, yard fit, safety
- Recommendation summary

## Data Model Implications

These files reveal the core entities Bramble needs:

1. **Plant** — species, cultivar, latin name, care requirements, toxicity, status
2. **Zone/Location** — named garden areas with sun exposure, soil type
3. **Container** — specific pots/beds with dimensions, placement
4. **Care Task** — seasonal/monthly calendar entries tied to plants and zones
5. **Budget Item** — vendor, price, status, phase
6. **Safety Rating** — per-plant toxicity for dogs, cats, children
7. **Property** — lot dimensions, orientation, structure footprint, sun exposure patterns
