import { BookOpen } from "lucide-react";
import Card from "../ui/Card";
import { useToast } from "../ui/Toast";
import JournalEntryCard from "./JournalEntryCard";
import AddObservationForm from "./AddObservationForm";
import {
  useJournalEntries,
  useCreateJournalEntry,
  useDeleteJournalEntry,
  useUploadPhoto,
} from "../../api/hooks";

interface Props {
  plantInstanceId: number;
}

export default function JournalTimeline({ plantInstanceId }: Props) {
  const { data: entries, isLoading } = useJournalEntries(plantInstanceId);
  const createEntry = useCreateJournalEntry();
  const deleteEntry = useDeleteJournalEntry();
  const uploadPhoto = useUploadPhoto();
  const { showToast } = useToast();

  const handleAddObservation = async (data: { body: string; imageData?: string }) => {
    try {
      let photoIds: number[] | undefined;

      // Upload photo first if provided
      if (data.imageData) {
        const photo = await uploadPhoto.mutateAsync({
          plantInstanceId,
          imageData: data.imageData,
        });
        photoIds = [photo.id];
      }

      await createEntry.mutateAsync({
        plantInstanceId,
        entryType: "observation",
        body: data.body || null,
        photoIds,
      });
      showToast("Journal entry added", "success");
    } catch {
      showToast("Failed to add journal entry", "error");
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteEntry.mutateAsync(id);
      showToast("Entry deleted", "success");
    } catch {
      showToast("Failed to delete entry", "error");
    }
  };

  const isSubmitting = createEntry.isPending || uploadPhoto.isPending;

  return (
    <Card>
      <h2 className="text-sm font-semibold font-display text-stone-300 uppercase tracking-wider mb-4">
        Journal
      </h2>

      <AddObservationForm
        onSubmit={handleAddObservation}
        isSubmitting={isSubmitting}
      />

      <div className="mt-5 border-t border-stone-800 pt-4">
        {isLoading ? (
          <p className="text-stone-500 text-sm text-center py-4">Loading journal...</p>
        ) : !entries || entries.length === 0 ? (
          <div className="text-center py-6">
            <BookOpen className="mx-auto text-stone-600 mb-2" size={24} />
            <p className="text-stone-500 text-sm font-display">
              No journal entries yet. Add an observation or complete a care task!
            </p>
          </div>
        ) : (
          <div>
            {entries.map((entry) => (
              <JournalEntryCard
                key={entry.id}
                entry={entry}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
