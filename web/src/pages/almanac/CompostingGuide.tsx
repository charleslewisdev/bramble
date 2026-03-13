import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold text-stone-100 font-display">
        {title}
      </h2>
      {children}
    </section>
  );
}

function DataTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: string[][];
}) {
  return (
    <div className="bg-stone-900 border border-stone-800 rounded-xl overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-stone-800">
            {headers.map((h) => (
              <th
                key={h}
                className="px-4 py-3 text-left text-stone-400 font-mono text-xs uppercase tracking-wider"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-800/50">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-stone-800/30 transition-colors">
              {row.map((cell, j) => (
                <td
                  key={j}
                  className={`px-4 py-2.5 ${
                    j === 0
                      ? "text-stone-200 font-display font-medium"
                      : "text-stone-300 font-mono"
                  }`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function CompostingGuide() {
  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <Link
          to="/almanac"
          className="inline-flex items-center gap-1.5 text-sm text-stone-400 hover:text-emerald-400 transition-colors mb-4"
        >
          <ArrowLeft size={14} />
          Back to Almanac
        </Link>
        <h1 className="text-2xl font-bold font-display text-stone-100">
          Composting Guide
        </h1>
        <p className="text-stone-400 text-sm mt-1">
          Everything you need to know about feeding your soil
        </p>
      </div>

      {/* 1. Compost vs. Fertilizer */}
      <Section title="Compost vs. Fertilizer">
        <div className="text-stone-300 space-y-3 leading-relaxed">
          <p>
            <strong className="text-stone-100">Compost feeds the soil</strong>{" "}
            — it improves structure, water retention, and beneficial microbe
            populations. Think of it as a long-term investment in soil health.
          </p>
          <p>
            <strong className="text-stone-100">
              Fertilizer feeds the plant
            </strong>{" "}
            — it delivers targeted NPK (nitrogen, phosphorus, potassium) for
            immediate uptake. Use it for specific deficiencies or heavy feeders.
          </p>
          <p>
            Use compost for general soil health, fertilizer for specific
            deficiencies, and both together for heavy feeders that demand a lot
            from the soil.
          </p>
        </div>
      </Section>

      {/* 2. Compost Types & NPK */}
      <Section title="Compost Types & NPK">
        <DataTable
          headers={["Type", "N", "P", "K", "Notes"]}
          rows={[
            [
              "Finished compost",
              "1-3",
              "0.5-2",
              "1-2",
              "Varies by inputs; 10-30% N available year one",
            ],
            [
              "Worm castings",
              "~1",
              "~0",
              "~0",
              "Exceptional for beneficial microbes",
            ],
            [
              "Rabbit manure",
              "2.4",
              "1.4",
              "0.6",
              "Cold manure — safe for direct application",
            ],
            [
              "Chicken manure",
              "1.1",
              "0.8",
              "0.5",
              "Hot manure — must compost first",
            ],
            [
              "Horse manure",
              "0.5",
              "0.3",
              "0.4",
              "Hot — often contains weed seeds",
            ],
            [
              "Mushroom compost",
              "0.7",
              "0.3",
              "0.3",
              "Tends alkaline",
            ],
          ]}
        />
      </Section>

      {/* 3. Rabbit Poop Compost */}
      <Section title="Rabbit Poop Compost">
        <div className="text-stone-300 space-y-3 leading-relaxed">
          <p>
            Rabbit manure has an NPK of{" "}
            <span className="font-mono text-emerald-400">2.4-1.4-0.6</span> and
            is classified as "cold" manure, meaning it can go directly on garden
            beds without composting first. This makes it one of the most
            convenient organic amendments available.
          </p>
          <p>
            Use it year-round: as a nitrogen boost in spring, a side dressing
            during summer growing season, and for soil replenishment in fall.
            Scatter pellets around plants but don't let them touch stems
            directly.
          </p>
          <p>
            If you prefer to compost it first, rabbit manure breaks down fully
            in 30-45 days. This can reduce any residual odor and create a more
            uniform amendment.
          </p>
          <div className="bg-stone-900 border border-stone-800 rounded-xl p-4">
            <p className="text-sm text-stone-400">
              <strong className="text-stone-200">Caution:</strong> Excess
              nitrogen can fork root crops (carrots, radishes) and promote leaf
              growth over blooms in flowering plants. Use sparingly around these
              crops.
            </p>
          </div>
        </div>
      </Section>

      {/* 4. Compost Tea */}
      <Section title="Compost Tea">
        <div className="text-stone-300 space-y-3 leading-relaxed">
          <p>Two primary brewing methods:</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="bg-stone-900 border border-stone-800 rounded-xl p-4 space-y-2">
              <h3 className="font-display font-semibold text-stone-100">
                Aerated
              </h3>
              <ul className="text-sm space-y-1 text-stone-400">
                <li>Air pump + air stones in a bucket</li>
                <li>Brew for 24-48 hours</li>
                <li>Must use within 4 hours of finishing</li>
              </ul>
            </div>
            <div className="bg-stone-900 border border-stone-800 rounded-xl p-4 space-y-2">
              <h3 className="font-display font-semibold text-stone-100">
                Non-aerated
              </h3>
              <ul className="text-sm space-y-1 text-stone-400">
                <li>Compost in a bucket of water</li>
                <li>Steep for 3-5 days, stir occasionally</li>
                <li>Simpler setup, longer brew time</li>
              </ul>
            </div>
          </div>
          <p>
            Compost tea has negligible NPK (roughly{" "}
            <span className="font-mono text-stone-400">
              0.07-0.02-0.05
            </span>
            ). Its primary value is delivering beneficial microbes to the soil.
            Apply as a soil drench or filtered foliar spray every 2-4 weeks
            during the growing season.
          </p>
          <div className="bg-stone-900 border border-stone-800 rounded-xl p-4">
            <p className="text-sm text-stone-400">
              <strong className="text-stone-200">Note:</strong> Scientific
              evidence for compost tea's disease suppression benefits is mixed.
              It's generally considered beneficial but not a substitute for good
              soil management practices.
            </p>
          </div>
        </div>
      </Section>

      {/* 5. Tea vs Extract vs Liquid Fertilizer */}
      <Section title="Tea vs Extract vs Liquid Fertilizer">
        <DataTable
          headers={["", "Compost Tea", "Compost Extract", "Liquid Fertilizer"]}
          rows={[
            ["Goal", "Breed microbes", "Extract nutrients", "Deliver NPK"],
            [
              "Method",
              "Aerated 24-48hrs",
              "Soaked 1-4hrs",
              "Buy ready-made",
            ],
            ["NPK", "Negligible", "Low", "Moderate-high"],
            [
              "Shelf life",
              "Use within 4hrs",
              "Use within 48hrs",
              "Weeks-months",
            ],
            ["Equipment", "Air pump, bucket", "Bucket only", "None"],
          ]}
        />
      </Section>

      {/* 6. Application Methods */}
      <Section title="Application Methods">
        <div className="text-stone-300 space-y-3 leading-relaxed">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="bg-stone-900 border border-stone-800 rounded-xl p-4 space-y-2">
              <h3 className="font-display font-semibold text-stone-100">
                Topdressing
              </h3>
              <p className="text-sm text-stone-400">
                Spread compost on the soil surface. Preferred method — preserves
                soil structure and lets worms and rain work it in naturally.
              </p>
            </div>
            <div className="bg-stone-900 border border-stone-800 rounded-xl p-4 space-y-2">
              <h3 className="font-display font-semibold text-stone-100">
                Tilling In
              </h3>
              <p className="text-sm text-stone-400">
                Mix compost into the top 4-6 inches of soil. Best for new beds
                or severely compacted soil that needs structural improvement.
              </p>
            </div>
          </div>
          <p>
            Apply 1-2 inches of compost annually for garden beds, either in fall
            (to break down over winter) or early spring (before planting
            season). Do not exceed 2 inches per year to avoid nutrient
            imbalances.
          </p>
        </div>
      </Section>

      {/* 7. Which Plants Love Compost */}
      <Section title="Which Plants Love Compost">
        <div className="text-stone-300 space-y-4 leading-relaxed">
          <div>
            <h3 className="font-display font-semibold text-stone-100 mb-2">
              Heavy Feeders
            </h3>
            <p>
              These plants thrive with generous compost applications: tomatoes,
              peppers, corn, squash, roses, hydrangeas, and dahlias. They
              benefit from both the nutrients and improved soil structure that
              compost provides.
            </p>
          </div>
          <div>
            <h3 className="font-display font-semibold text-stone-100 mb-2">
              Be Careful With
            </h3>
            <ul className="space-y-2 text-sm text-stone-400">
              <li>
                <strong className="text-stone-200">
                  Succulents and cacti
                </strong>{" "}
                — compost retains too much moisture for drought-adapted plants
              </li>
              <li>
                <strong className="text-stone-200">
                  Mediterranean herbs
                </strong>{" "}
                (lavender, rosemary) — prefer lean, well-drained soil
              </li>
              <li>
                <strong className="text-stone-200">Blueberries</strong> —
                prefer acidic conditions; compost tends neutral to alkaline
              </li>
              <li>
                <strong className="text-stone-200">Legumes</strong> (beans,
                peas) — fix their own nitrogen; extra N is wasted
              </li>
              <li>
                <strong className="text-stone-200">Root crops</strong>{" "}
                (carrots, radishes) — excess nitrogen causes forking and
                branching
              </li>
            </ul>
          </div>
        </div>
      </Section>
    </div>
  );
}
