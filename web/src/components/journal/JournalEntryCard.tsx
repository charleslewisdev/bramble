import { Trash2, Eye, CalendarCheck, ClipboardCheck, Star, HelpCircle } from "lucide-react";
import type { JournalEntry } from "../../api";
import ConfirmModal from "../ui/ConfirmModal";
import { useState } from "react";

const entryTypeConfig: Record<string, { icon: typeof Eye; label: string; color: string }> = {
  observation: { icon: Eye, label: "Observation", color: "text-blue-400" },
  care_log: { icon: CalendarCheck, label: "Care Log", color: "text-emerald-400" },
  status_check: { icon: ClipboardCheck, label: "Status Check", color: "text-amber-400" },
  milestone: { icon: Star, label: "Milestone", color: "text-purple-400" },
  identification: { icon: HelpCircle, label: "ID Request", color: "text-cyan-400" },
};

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

interface Props {
  entry: JournalEntry;
  onDelete: (id: number) => void;
}

export default function JournalEntryCard({ entry, onDelete }: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const config = entryTypeConfig[entry.entryType] ?? entryTypeConfig.observation!;
  const Icon = config.icon;
  const photos = entry.photos ?? [];

  return (
    <div className="flex gap-3 group">
      {/* Timeline dot */}
      <div className="flex flex-col items-center">
        <div className={`p-1.5 rounded-full bg-stone-800 border border-stone-700 ${config.color}`}>
          <Icon size={14} />
        </div>
        <div className="flex-1 w-px bg-stone-800 mt-1" />
      </div>

      {/* Content */}
      <div className="flex-1 pb-5 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-display font-semibold ${config.color}`}>{config.label}</span>
              <span className="text-[10px] text-stone-500 font-mono">{timeAgo(entry.createdAt)}</span>
            </div>
            {entry.title && (
              <p className="text-sm text-stone-200 font-display mt-0.5">{entry.title}</p>
            )}
          </div>
          <button
            onClick={() => setConfirmDelete(true)}
            className="p-1 rounded text-stone-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all shrink-0"
          >
            <Trash2 size={12} />
          </button>
        </div>

        {entry.body && (
          <p className="text-sm text-stone-400 mt-1 whitespace-pre-wrap">{entry.body}</p>
        )}

        {/* Inline photo thumbnails */}
        {photos.length > 0 && (
          <div className="flex gap-2 mt-2 overflow-x-auto">
            {photos.map((jp) => (
              <img
                key={jp.id}
                src={`/api/photos/file/${jp.plantPhoto?.thumbnailFilename || jp.plantPhoto?.filename}`}
                alt={jp.plantPhoto?.caption ?? "Photo"}
                className="w-20 h-20 object-cover rounded-lg border border-stone-700 shrink-0"
              />
            ))}
          </div>
        )}
      </div>

      <ConfirmModal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => onDelete(entry.id)}
        title="Delete journal entry?"
        message="This will remove the entry from your plant's timeline. Photos will not be deleted."
        variant="destructive"
      />
    </div>
  );
}
