import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BookOpen, Plus, Tag as TagIcon } from "lucide-react";
import clsx from "clsx";
import Button from "../components/ui/Button";
import PlantSprite from "../components/sprites/PlantSprite";
import {
  useAlmanacEntries,
  useCreateAlmanacEntry,
} from "../api/hooks";

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export default function Almanac() {
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const { data, isLoading } = useAlmanacEntries(activeTag ?? undefined);
  const createEntry = useCreateAlmanacEntry();
  const navigate = useNavigate();

  function handleNew() {
    createEntry.mutate(
      {},
      {
        onSuccess: (entry) => navigate(`/almanac/${entry.slug}/edit`),
      },
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3">
            <BookOpen size={24} className="text-emerald-400" />
            <h1 className="text-2xl font-bold font-display text-stone-100">
              Almanac
            </h1>
          </div>
          <p className="text-stone-400 text-sm mt-1">
            Your garden notes, plans, and reference guides
          </p>
        </div>
        <Button onClick={handleNew} disabled={createEntry.isPending}>
          <Plus size={16} />
          {createEntry.isPending ? "Creating…" : "New Entry"}
        </Button>
      </div>

      {/* Tag filter */}
      {(data?.tags.length ?? 0) > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <TagIcon size={14} className="text-stone-500" />
          <button
            onClick={() => setActiveTag(null)}
            className={clsx(
              "px-2.5 py-1 rounded-md text-xs font-display transition-colors",
              activeTag === null
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                : "bg-stone-800/60 text-stone-400 border border-stone-800 hover:border-stone-700",
            )}
          >
            All
          </button>
          {data!.tags.map((t) => (
            <button
              key={t.name}
              onClick={() => setActiveTag(t.name)}
              className={clsx(
                "px-2.5 py-1 rounded-md text-xs font-display transition-colors",
                activeTag === t.name
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                  : "bg-stone-800/60 text-stone-400 border border-stone-800 hover:border-stone-700",
              )}
            >
              {t.name}
              <span className="ml-1.5 font-mono text-[10px] text-stone-500">
                {t.count}
              </span>
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <PlantSprite type="flower" mood="sleeping" size={48} className="animate-pulse" />
        </div>
      ) : (data?.entries.length ?? 0) === 0 ? (
        <div className="text-center py-16 bg-stone-900/50 border border-dashed border-stone-800 rounded-xl">
          <PlantSprite type="herb" mood="sleeping" size={64} className="mx-auto" />
          <p className="text-stone-400 font-display mt-4">
            {activeTag
              ? `No entries tagged "${activeTag}".`
              : "No almanac entries yet. Plant your first note."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data!.entries.map((entry) => (
            <Link
              key={entry.id}
              to={`/almanac/${entry.slug}`}
              className="group block p-5 bg-stone-900 border border-stone-800 rounded-xl hover:border-emerald-600/40 hover:bg-stone-800/60 transition-colors"
            >
              <h2 className="text-lg font-semibold font-display text-stone-100 group-hover:text-emerald-400 transition-colors">
                {entry.title}
              </h2>
              {entry.excerpt && (
                <p className="text-sm text-stone-400 mt-2 leading-relaxed line-clamp-3">
                  {entry.excerpt}
                </p>
              )}
              <div className="flex items-center justify-between mt-4 gap-2">
                <div className="flex flex-wrap gap-1">
                  {entry.tags.slice(0, 3).map((t) => (
                    <span
                      key={t}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-stone-800 text-stone-400 font-display"
                    >
                      {t}
                    </span>
                  ))}
                </div>
                <span className="text-[10px] text-stone-500 font-mono whitespace-nowrap">
                  {formatDate(entry.updatedAt)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
