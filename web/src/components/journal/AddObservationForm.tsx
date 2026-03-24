import { useState, useRef } from "react";
import { Camera, Send } from "lucide-react";
import Button from "../ui/Button";
import { Textarea } from "../ui/Input";

interface Props {
  onSubmit: (data: { body: string; imageData?: string }) => void;
  isSubmitting?: boolean;
}

export default function AddObservationForm({ onSubmit, isSubmitting }: Props) {
  const [body, setBody] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [imageData, setImageData] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setImageData(result);
      setPreview(result);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = () => {
    if (!body.trim() && !imageData) return;
    onSubmit({ body: body.trim(), imageData: imageData ?? undefined });
    setBody("");
    setPreview(null);
    setImageData(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="space-y-2">
      <Textarea
        placeholder="What's happening with your plant?"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={2}
        className="text-sm resize-none"
      />
      {preview && (
        <div className="relative inline-block">
          <img src={preview} alt="Preview" className="w-20 h-20 object-cover rounded-lg border border-stone-700" />
          <button
            onClick={() => { setPreview(null); setImageData(null); if (fileRef.current) fileRef.current.value = ""; }}
            className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-stone-700 text-stone-300 hover:text-white flex items-center justify-center text-xs"
          >
            ×
          </button>
        </div>
      )}
      <div className="flex items-center gap-2">
        <Button size="sm" variant="ghost" onClick={() => fileRef.current?.click()} type="button">
          <Camera size={14} />
        </Button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
        <div className="flex-1" />
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={isSubmitting || (!body.trim() && !imageData)}
        >
          <Send size={14} /> Add Note
        </Button>
      </div>
    </div>
  );
}
