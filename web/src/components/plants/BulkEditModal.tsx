import { useState } from "react";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import { Select } from "../ui/Input";
import type { PlantInstance } from "../../api";
import { useZones } from "../../api/hooks";

interface BulkEditModalProps {
  open: boolean;
  onClose: () => void;
  selectedCount: number;
  onSubmit: (data: Partial<PlantInstance>) => void;
  isPending?: boolean;
}

const statusOptions = [
  "planned", "planted", "established", "struggling", "dormant", "dead", "removed",
] as const;

const moodOptions = [
  "happy", "thirsty", "cold", "hot", "wilting", "sleeping", "new",
] as const;

const containerMaterials = [
  "terracotta", "ceramic", "plastic", "fabric", "metal", "wood", "concrete", "fiberglass", "stone",
] as const;

const containerShapes = [
  "round", "square", "rectangular", "oval", "hanging", "window_box", "other",
] as const;

export default function BulkEditModal({
  open,
  onClose,
  selectedCount,
  onSubmit,
  isPending,
}: BulkEditModalProps) {
  const { data: zones } = useZones();
  const [field, setField] = useState("");
  const [value, setValue] = useState("");

  function handleSubmit() {
    if (!field || !value) return;

    const data: Partial<PlantInstance> = {};
    switch (field) {
      case "status":
        (data as Record<string, unknown>).status = value;
        break;
      case "zoneId":
        (data as Record<string, unknown>).zoneId = value === "null" ? null : Number(value);
        break;
      case "isContainer":
        (data as Record<string, unknown>).isContainer = value === "true";
        break;
      case "containerMaterial":
        (data as Record<string, unknown>).containerMaterial = value;
        break;
      case "containerShape":
        (data as Record<string, unknown>).containerShape = value;
        break;
      case "outdoorCandidate":
        (data as Record<string, unknown>).outdoorCandidate = value === "true";
        break;
      case "mood":
        (data as Record<string, unknown>).mood = value;
        break;
    }

    onSubmit(data);
    setField("");
    setValue("");
  }

  function handleClose() {
    setField("");
    setValue("");
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} title="Bulk Edit Plants">
      <div className="space-y-4">
        <p className="text-sm text-stone-400">
          Apply changes to <span className="text-emerald-400 font-mono">{selectedCount}</span> selected plant{selectedCount !== 1 ? "s" : ""}.
        </p>

        <Select
          label="Field to update"
          value={field}
          onChange={(e) => { setField(e.target.value); setValue(""); }}
        >
          <option value="">Select field...</option>
          <option value="status">Status</option>
          <option value="zoneId">Zone</option>
          <option value="isContainer">In Container</option>
          <option value="containerMaterial">Container Material</option>
          <option value="containerShape">Container Shape</option>
          <option value="outdoorCandidate">Outdoor Candidate</option>
          <option value="mood">Mood</option>
        </Select>

        {field === "status" && (
          <Select label="New status" value={value} onChange={(e) => setValue(e.target.value)}>
            <option value="">Select...</option>
            {statusOptions.map((s) => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </Select>
        )}

        {field === "zoneId" && (
          <Select label="New zone" value={value} onChange={(e) => setValue(e.target.value)}>
            <option value="">Select...</option>
            <option value="null">Unassigned (no zone)</option>
            {zones?.map((z) => (
              <option key={z.id} value={z.id}>{z.name}</option>
            ))}
          </Select>
        )}

        {field === "isContainer" && (
          <Select label="In container?" value={value} onChange={(e) => setValue(e.target.value)}>
            <option value="">Select...</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </Select>
        )}

        {field === "containerMaterial" && (
          <Select label="Material" value={value} onChange={(e) => setValue(e.target.value)}>
            <option value="">Select...</option>
            {containerMaterials.map((m) => (
              <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
            ))}
          </Select>
        )}

        {field === "containerShape" && (
          <Select label="Shape" value={value} onChange={(e) => setValue(e.target.value)}>
            <option value="">Select...</option>
            {containerShapes.map((s) => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1).replace("_", " ")}</option>
            ))}
          </Select>
        )}

        {field === "outdoorCandidate" && (
          <Select label="Outdoor candidate?" value={value} onChange={(e) => setValue(e.target.value)}>
            <option value="">Select...</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </Select>
        )}

        {field === "mood" && (
          <Select label="New mood" value={value} onChange={(e) => setValue(e.target.value)}>
            <option value="">Select...</option>
            {moodOptions.map((m) => (
              <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
            ))}
          </Select>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!field || !value || isPending}
          >
            {isPending ? "Updating..." : "Apply to Selected"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
