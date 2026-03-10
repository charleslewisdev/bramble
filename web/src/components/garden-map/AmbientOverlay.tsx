/**
 * Day/night ambient color overlay based on real sun data.
 * Renders as a full-screen semi-transparent gradient over the canvas.
 */

import type { SunData } from "../../api";

interface AmbientOverlayProps {
  sunData?: SunData | null;
}

function getTimeOfDay(sunData: SunData): {
  phase: "night" | "dawn" | "day" | "dusk" | "night_late";
  progress: number;
} {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const sunrise = parseTimeToMinutes(sunData.sunrise);
  const sunset = parseTimeToMinutes(sunData.sunset);

  const dawnStart = sunrise - 45;
  const dawnEnd = sunrise + 30;
  const duskStart = sunset - 30;
  const duskEnd = sunset + 45;

  if (currentMinutes < dawnStart) {
    return { phase: "night", progress: 1 };
  } else if (currentMinutes < dawnEnd) {
    const progress = (currentMinutes - dawnStart) / (dawnEnd - dawnStart);
    return { phase: "dawn", progress };
  } else if (currentMinutes < duskStart) {
    return { phase: "day", progress: 0 };
  } else if (currentMinutes < duskEnd) {
    const progress = (currentMinutes - duskStart) / (duskEnd - duskStart);
    return { phase: "dusk", progress };
  } else {
    return { phase: "night_late", progress: 1 };
  }
}

function parseTimeToMinutes(timeStr: string): number {
  try {
    const date = new Date(timeStr);
    return date.getHours() * 60 + date.getMinutes();
  } catch {
    return 720; // noon fallback
  }
}

export default function AmbientOverlay({ sunData }: AmbientOverlayProps) {
  if (!sunData) return null;

  const { phase, progress } = getTimeOfDay(sunData);

  let backgroundColor = "transparent";
  let opacity = 0;

  switch (phase) {
    case "night":
    case "night_late":
      backgroundColor = "rgb(15, 23, 42)"; // slate-900
      opacity = 0.4;
      break;
    case "dawn":
      backgroundColor = `rgb(${Math.round(251 * (1 - progress))}, ${Math.round(146 * (1 - progress))}, ${Math.round(60 * (1 - progress))})`;
      opacity = 0.15 * (1 - progress);
      break;
    case "day":
      return null; // No overlay during day
    case "dusk":
      backgroundColor = `rgb(${Math.round(180 + 70 * progress)}, ${Math.round(83 * progress)}, ${Math.round(9 + 50 * progress)})`;
      opacity = 0.12 * progress;
      break;
  }

  return (
    <div
      className="fixed inset-0 z-[51] pointer-events-none transition-colors duration-[5000ms]"
      style={{
        backgroundColor,
        opacity,
      }}
    />
  );
}
