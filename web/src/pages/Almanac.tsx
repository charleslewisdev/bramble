import { BookOpen, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

const guides = [
  {
    to: "/almanac/composting",
    title: "Composting Guide",
    description:
      "Compost types, NPK ratios, rabbit manure, compost tea, and application methods",
  },
];

export default function Almanac() {
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <BookOpen size={24} className="text-emerald-400" />
          <h1 className="text-2xl font-bold font-display text-stone-100">
            Almanac
          </h1>
        </div>
        <p className="text-stone-400 text-sm mt-1">
          Reference guides for your garden
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {guides.map((guide) => (
          <Link
            key={guide.to}
            to={guide.to}
            className="group block p-5 bg-stone-900 border border-stone-800 rounded-xl hover:border-emerald-600/40 hover:bg-stone-800/60 transition-colors"
          >
            <h2 className="text-lg font-semibold font-display text-stone-100 group-hover:text-emerald-400 transition-colors">
              {guide.title}
            </h2>
            <p className="text-sm text-stone-400 mt-2 leading-relaxed">
              {guide.description}
            </p>
            <span className="inline-flex items-center gap-1 text-xs text-emerald-500 mt-4 font-mono">
              Read guide <ArrowRight size={12} />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
