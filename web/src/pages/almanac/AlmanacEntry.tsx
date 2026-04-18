import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Button from "../../components/ui/Button";
import ConfirmModal from "../../components/ui/ConfirmModal";
import PlantSprite from "../../components/sprites/PlantSprite";
import {
  useAlmanacEntry,
  useDeleteAlmanacEntry,
} from "../../api/hooks";

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export default function AlmanacEntry() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { data: entry, isLoading, error } = useAlmanacEntry(slug);
  const deleteEntry = useDeleteAlmanacEntry();
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <PlantSprite type="flower" mood="sleeping" size={48} className="animate-pulse" />
      </div>
    );
  }

  if (error || !entry) {
    return (
      <div className="max-w-3xl space-y-4">
        <Link
          to="/almanac"
          className="inline-flex items-center gap-1.5 text-sm text-stone-400 hover:text-emerald-400 transition-colors"
        >
          <ArrowLeft size={14} />
          Back to Almanac
        </Link>
        <div className="text-center py-16 bg-stone-900/50 border border-dashed border-stone-800 rounded-xl">
          <PlantSprite type="flower" mood="sleeping" size={64} className="mx-auto" />
          <p className="text-stone-400 font-display mt-4">Entry not found.</p>
        </div>
      </div>
    );
  }

  function handleDelete() {
    if (!entry) return;
    deleteEntry.mutate(entry.id, {
      onSuccess: () => navigate("/almanac"),
    });
  }

  return (
    <div className="max-w-3xl space-y-6">
      <Link
        to="/almanac"
        className="inline-flex items-center gap-1.5 text-sm text-stone-400 hover:text-emerald-400 transition-colors"
      >
        <ArrowLeft size={14} />
        Back to Almanac
      </Link>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl font-bold font-display text-stone-100">
            {entry.title}
          </h1>
          <div className="flex items-center gap-2 flex-wrap mt-2">
            <span className="text-xs font-mono text-stone-500">
              Updated {formatDate(entry.updatedAt)}
            </span>
            {entry.tags.length > 0 && (
              <>
                <span className="text-stone-700">·</span>
                <div className="flex flex-wrap gap-1">
                  {entry.tags.map((t) => (
                    <Link
                      key={t}
                      to={`/almanac?tag=${encodeURIComponent(t)}`}
                      className="text-[11px] px-2 py-0.5 rounded bg-stone-800 text-stone-400 font-display hover:text-emerald-400 transition-colors"
                    >
                      {t}
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Link to={`/almanac/${entry.slug}/edit`}>
            <Button variant="secondary" size="sm">
              <Pencil size={14} />
              Edit
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirmOpen(true)}
            className="text-red-400 hover:text-red-300"
          >
            <Trash2 size={14} />
          </Button>
        </div>
      </div>

      <article className="almanac-prose text-stone-200">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{entry.content}</ReactMarkdown>
      </article>

      <ConfirmModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleDelete}
        title="Delete this entry?"
        message={`"${entry.title}" will be permanently deleted, along with any images uploaded to it.`}
        confirmLabel="Delete"
        variant="destructive"
      />
    </div>
  );
}
