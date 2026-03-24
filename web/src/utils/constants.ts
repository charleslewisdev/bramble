import type { PlantStatus, CareTaskType } from "../api";

export const statusOptions: PlantStatus[] = [
  "planned",
  "planted",
  "established",
  "struggling",
  "dormant",
  "dead",
  "removed",
];

export const taskTypes: CareTaskType[] = [
  "water",
  "fertilize",
  "prune",
  "mulch",
  "harvest",
  "protect",
  "move",
  "repot",
  "inspect",
  "status_check",
  "custom",
];

export const taskTypeIcons: Record<CareTaskType, string> = {
  water: "\u{1f4a7}",
  fertilize: "\u{1f9ea}",
  prune: "\u{2702}\u{fe0f}",
  mulch: "\u{1f342}",
  harvest: "\u{1f9fa}",
  protect: "\u{1f6e1}",
  move: "\u{1f504}",
  repot: "\u{1fab4}",
  inspect: "\u{1f50d}",
  status_check: "\u{1f4f8}",
  custom: "\u{1f4cb}",
};

export const monthNames = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
