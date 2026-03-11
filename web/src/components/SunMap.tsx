import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Sun, Play, Pause, Calendar, Clock } from "lucide-react";
import Button from "./ui/Button";
import Card from "./ui/Card";
import { useToast } from "./ui/Toast";
import {
  useSunDataForDate,
  useSunShadows,
  useSunDayArc,
  useSunData,
} from "../api/hooks";
import type { Zone, Structure, ShadowPolygon } from "../api";

// ---------- Helpers ----------

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatTimeFromMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.round(totalMinutes % 60);
  const h = hours % 24;
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(minutes).padStart(2, "0")} ${ampm}`;
}

function minutesFromIso(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

function toIsoTime(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = Math.round(totalMinutes % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dayLengthDiff(a: number, b: number): string {
  const diff = Math.abs(a - b);
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  const parts: string[] = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  return parts.join(" ") || "0m";
}

const SEASON_DATES = {
  "Summer Solstice": { month: "06", day: "21" },
  "Winter Solstice": { month: "12", day: "21" },
  "Spring Equinox": { month: "03", day: "20" },
  "Fall Equinox": { month: "09", day: "22" },
} as const;

function getSeasonDate(label: string): string {
  const entry = SEASON_DATES[label as keyof typeof SEASON_DATES];
  if (!entry) return todayStr();
  const year = new Date().getFullYear();
  return `${year}-${entry.month}-${entry.day}`;
}

function getCurrentSeason(): string {
  const m = new Date().getMonth(); // 0-11
  if (m >= 2 && m <= 4) return "Spring Equinox";
  if (m >= 5 && m <= 7) return "Summer Solstice";
  if (m >= 8 && m <= 10) return "Fall Equinox";
  return "Winter Solstice";
}

// Check if zone center is inside any shadow polygon at a given time
function pointInPolygon(
  px: number,
  py: number,
  polygon: { x: number; y: number }[],
): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i]!.x,
      yi = polygon[i]!.y;
    const xj = polygon[j]!.x,
      yj = polygon[j]!.y;
    const intersect =
      yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// ---------- Props ----------

interface SunMapProps {
  locationId: number;
  lotW: number;
  lotD: number;
  scaleFactor: number;
  zones: Zone[];
  structures: Structure[];
}

// ---------- Component ----------

export default function SunMap({
  locationId,
  lotW,
  lotD,
  scaleFactor,
  zones,
  structures,
}: SunMapProps) {
  const { showToast } = useToast();
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [sliderMinutes, setSliderMinutes] = useState<number | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const animationRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedTime, setDebouncedTime] = useState<string | undefined>(
    undefined,
  );

  // Fetch sun data for the selected date
  const { data: dateSunData, isError: sunDataError } =
    useSunDataForDate(locationId, selectedDate);
  // Fetch today's sun data for comparison
  const { data: todaySunData } = useSunData(locationId);
  // Fetch day arc
  const { data: dayArc } = useSunDayArc(locationId, selectedDate);
  // Fetch shadows for the debounced time
  const {
    data: shadows,
    isError: shadowsError,
    isFetching: shadowsFetching,
  } = useSunShadows(locationId, selectedDate, debouncedTime);

  // Previous shadows to prevent flashing
  const prevShadowsRef = useRef<ShadowPolygon[]>([]);
  const displayShadows = shadows ?? prevShadowsRef.current;
  useEffect(() => {
    if (shadows) prevShadowsRef.current = shadows;
  }, [shadows]);

  // Sunrise/sunset in minutes for slider range
  const sunriseMin = dateSunData ? minutesFromIso(dateSunData.sunrise) : 360;
  const sunsetMin = dateSunData ? minutesFromIso(dateSunData.sunset) : 1200;

  // Initialize slider to current time or solar noon
  useEffect(() => {
    if (dateSunData) {
      const now = new Date();
      const todayDate = todayStr();
      if (selectedDate === todayDate) {
        const currentMin = now.getHours() * 60 + now.getMinutes();
        const clamped = Math.max(
          sunriseMin,
          Math.min(sunsetMin, currentMin),
        );
        setSliderMinutes(Math.round(clamped / 15) * 15);
      } else {
        setSliderMinutes(
          Math.round(minutesFromIso(dateSunData.solarNoon) / 15) * 15,
        );
      }
    }
  }, [dateSunData, selectedDate]);

  // Debounce time slider changes
  useEffect(() => {
    if (sliderMinutes == null) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedTime(toIsoTime(sliderMinutes));
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [sliderMinutes]);

  // Animation
  useEffect(() => {
    if (!isAnimating) {
      if (animationRef.current) {
        clearInterval(animationRef.current);
        animationRef.current = null;
      }
      return;
    }
    animationRef.current = setInterval(() => {
      setSliderMinutes((prev) => {
        const current = prev ?? sunriseMin;
        const next = current + 15;
        if (next > sunsetMin) {
          setIsAnimating(false);
          return sunriseMin;
        }
        return next;
      });
    }, 2000);
    return () => {
      if (animationRef.current) clearInterval(animationRef.current);
    };
  }, [isAnimating, sunriseMin, sunsetMin]);

  // Show error toast
  useEffect(() => {
    if (shadowsError) {
      showToast("Shadow data unavailable", "error");
    }
  }, [shadowsError, showToast]);

  const handleDatePreset = useCallback((label: string) => {
    if (label === "Today") {
      setSelectedDate(todayStr());
    } else {
      setSelectedDate(getSeasonDate(label));
    }
  }, []);

  // Check which zones are currently in shadow
  const zonesInShadow = useMemo(() => {
    if (!displayShadows || displayShadows.length === 0) return new Set<number>();
    const inShadow = new Set<number>();
    for (const zone of zones) {
      const cx = zone.posX + zone.width / 2;
      const cy = zone.posY + zone.depth / 2;
      for (const shadow of displayShadows) {
        if (pointInPolygon(cx, cy, shadow.polygon)) {
          inShadow.add(zone.id);
          break;
        }
      }
    }
    return inShadow;
  }, [displayShadows, zones]);

  // Find current sun position from dayArc data
  const currentArcPoint = useMemo(() => {
    if (!dayArc || dayArc.length === 0 || sliderMinutes == null) return null;
    // Find the closest arc point to current slider time
    const sliderHour = sliderMinutes / 60;
    let closest = dayArc[0]!;
    let closestDiff = Math.abs(closest.hour - sliderHour);
    for (const pt of dayArc) {
      const diff = Math.abs(pt.hour - sliderHour);
      if (diff < closestDiff) {
        closest = pt;
        closestDiff = diff;
      }
    }
    return closest;
  }, [dayArc, sliderMinutes]);

  // SVG dimensions
  const svgW = lotW * scaleFactor;
  const svgH = lotD * scaleFactor;
  const arcH = 50;

  // Compute sun position on arc (right=E to left=W, bottom arc)
  const sunArcPosition = useMemo(() => {
    if (!dateSunData || sliderMinutes == null) return null;
    const total = sunsetMin - sunriseMin;
    if (total <= 0) return null;
    const t = Math.max(0, Math.min(1, (sliderMinutes - sunriseMin) / total));
    const x = (1 - t) * svgW; // right (east) to left (west)
    const ctrlY = 80;
    const y = (1 - t) * (1 - t) * 2 + 2 * (1 - t) * t * ctrlY + t * t * 2;
    return { x, y, t };
  }, [dateSunData, sliderMinutes, sunriseMin, sunsetMin, svgW]);

  // Day length comparison
  const dayLengthComparison = useMemo(() => {
    if (
      !dateSunData ||
      !todaySunData ||
      selectedDate === todayStr()
    )
      return null;
    const diff =
      dateSunData.dayLengthMinutes - todaySunData.dayLengthMinutes;
    if (diff === 0) return null;
    return {
      diff: Math.abs(diff),
      more: diff > 0,
      text: `${dayLengthDiff(dateSunData.dayLengthMinutes, todaySunData.dayLengthMinutes)} ${diff > 0 ? "more" : "less"} daylight than today`,
    };
  }, [dateSunData, todaySunData, selectedDate]);

  const currentSeason = getCurrentSeason();

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="p-4 rounded-xl bg-stone-900 border border-stone-800 space-y-4">
        {/* Date row */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar size={14} className="text-stone-500" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-stone-800 border border-stone-700 rounded-lg px-3 py-1.5 text-sm text-stone-200 font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {["Today", "Summer Solstice", "Winter Solstice", "Spring Equinox", "Fall Equinox"].map(
              (preset) => (
                <button
                  key={preset}
                  onClick={() => handleDatePreset(preset)}
                  className={`px-2.5 py-1 rounded-md text-xs font-display transition-colors ${
                    (preset === "Today" && selectedDate === todayStr()) ||
                    (preset !== "Today" &&
                      selectedDate === getSeasonDate(preset))
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : "bg-stone-800 text-stone-400 border border-stone-700 hover:text-stone-200 hover:border-stone-600"
                  }`}
                >
                  {preset}
                </button>
              ),
            )}
          </div>
        </div>

        {/* Time slider row */}
        <div className="flex items-center gap-3">
          <Clock size={14} className="text-stone-500 shrink-0" />
          <div className="flex-1 space-y-1">
            <input
              type="range"
              min={sunriseMin}
              max={sunsetMin}
              step={15}
              value={sliderMinutes ?? sunriseMin}
              onChange={(e) => setSliderMinutes(Number(e.target.value))}
              className="w-full h-2 bg-stone-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
            <div className="flex justify-between text-[10px] text-stone-500 font-mono">
              <span>{dateSunData ? formatTime(dateSunData.sunrise) : "--"}</span>
              <span className="text-stone-300 text-xs font-medium">
                {sliderMinutes != null
                  ? formatTimeFromMinutes(sliderMinutes)
                  : "--"}
              </span>
              <span>{dateSunData ? formatTime(dateSunData.sunset) : "--"}</span>
            </div>
          </div>
          <Button
            size="sm"
            variant={isAnimating ? "primary" : "ghost"}
            onClick={() => setIsAnimating(!isAnimating)}
          >
            {isAnimating ? <Pause size={14} /> : <Play size={14} />}
          </Button>
        </div>

        {/* Day info */}
        {dateSunData && (
          <div className="flex flex-wrap items-center gap-4 text-xs text-stone-400 font-mono pt-2 border-t border-stone-800">
            <span>
              Sunrise: {formatTime(dateSunData.sunrise)}
            </span>
            <span>
              Solar Noon: {formatTime(dateSunData.solarNoon)}
            </span>
            <span>
              Sunset: {formatTime(dateSunData.sunset)}
            </span>
            <span>Day: {dateSunData.dayLength}</span>
            {dayLengthComparison && (
              <span
                className={
                  dayLengthComparison.more
                    ? "text-emerald-400"
                    : "text-amber-400"
                }
              >
                {dayLengthComparison.text}
              </span>
            )}
          </div>
        )}

        {sunDataError && (
          <p className="text-xs text-red-400 font-mono">
            Sun data unavailable for this date.
          </p>
        )}
      </div>

      {/* Shadow Map SVG Overlay */}
      <div className="flex justify-center p-4 pb-20">
        <div className="relative">
          {/* Sun arc — south side (bottom), east=right to west=left */}
          <svg
            className="absolute -bottom-14 left-0 pointer-events-none"
            width={svgW}
            height={arcH}
            viewBox={`0 0 ${svgW} ${arcH}`}
          >
            <path
              d={`M ${svgW} 2 Q ${svgW * 0.5} 80 0 2`}
              fill="none"
              stroke="rgba(250, 204, 21, 0.3)"
              strokeWidth={2}
              strokeDasharray="4 4"
            />
            {/* E/W labels */}
            <text x={svgW - 4} y={12} textAnchor="end" fill="#a8a29e" fontSize={9} fontFamily="var(--font-mono)">E</text>
            <text x={4} y={12} textAnchor="start" fill="#a8a29e" fontSize={9} fontFamily="var(--font-mono)">W</text>
            {/* Sun position on arc */}
            {sunArcPosition && (
              <g>
                <circle
                  cx={sunArcPosition.x}
                  cy={sunArcPosition.y}
                  r={10}
                  fill="#facc15"
                  opacity={0.9}
                >
                  <animate
                    attributeName="opacity"
                    values="0.7;1;0.7"
                    dur="3s"
                    repeatCount="indefinite"
                  />
                </circle>
                {/* Sun rays */}
                {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
                  <line
                    key={angle}
                    x1={sunArcPosition.x + 12 * Math.cos((angle * Math.PI) / 180)}
                    y1={sunArcPosition.y + 12 * Math.sin((angle * Math.PI) / 180)}
                    x2={sunArcPosition.x + 15 * Math.cos((angle * Math.PI) / 180)}
                    y2={sunArcPosition.y + 15 * Math.sin((angle * Math.PI) / 180)}
                    stroke="#facc15"
                    strokeWidth={1.5}
                    opacity={0.6}
                  />
                ))}
              </g>
            )}
            {/* Azimuth/altitude label */}
            {currentArcPoint && sunArcPosition && (
              <text
                x={Math.max(40, Math.min(svgW - 40, sunArcPosition.x))}
                y={Math.max(10, sunArcPosition.y - 18)}
                textAnchor="middle"
                fill="#a8a29e"
                fontSize={9}
                fontFamily="var(--font-mono)"
              >
                {currentArcPoint.altitude.toFixed(1)}° alt /{" "}
                {currentArcPoint.azimuth.toFixed(0)}° az
              </text>
            )}
          </svg>

          {/* Lot map with shadows */}
          <svg
            width={svgW}
            height={svgH}
            viewBox={`0 0 ${lotW} ${lotD}`}
            className="border-2 border-dashed border-amber-700/30 rounded-lg bg-stone-950/50"
          >
            {/* Grid lines */}
            {Array.from({ length: Math.floor(lotW / 10) + 1 }).map((_, i) => (
              <line
                key={`gv-${i}`}
                x1={i * 10}
                y1={0}
                x2={i * 10}
                y2={lotD}
                stroke="rgba(120, 113, 108, 0.1)"
                strokeWidth={0.5}
              />
            ))}
            {Array.from({ length: Math.floor(lotD / 10) + 1 }).map((_, i) => (
              <line
                key={`gh-${i}`}
                x1={0}
                y1={i * 10}
                x2={lotW}
                y2={i * 10}
                stroke="rgba(120, 113, 108, 0.1)"
                strokeWidth={0.5}
              />
            ))}

            {/* Structures */}
            {structures.map((s) => (
              <g key={`struct-${s.id}`}>
                <rect
                  x={s.posX}
                  y={s.posY}
                  width={s.width}
                  height={s.depth}
                  fill="rgba(120, 113, 108, 0.4)"
                  stroke="rgba(168, 162, 158, 0.5)"
                  strokeWidth={0.5}
                  rx={0.5}
                />
                <text
                  x={s.posX + s.width / 2}
                  y={s.posY + s.depth / 2}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="#a8a29e"
                  fontSize={Math.min(s.width, s.depth) > 8 ? 3 : 2}
                  fontFamily="var(--font-display)"
                >
                  {s.name}
                </text>
              </g>
            ))}

            {/* Zones */}
            {zones.map((z) => {
              const inShadow = zonesInShadow.has(z.id);
              return (
                <g key={`zone-${z.id}`}>
                  <rect
                    x={z.posX}
                    y={z.posY}
                    width={z.width}
                    height={z.depth}
                    fill={`${z.color ?? "#4ade80"}20`}
                    stroke={`${z.color ?? "#4ade80"}60`}
                    strokeWidth={0.5}
                    rx={0.5}
                  />
                  <text
                    x={z.posX + z.width / 2}
                    y={z.posY + z.depth / 2}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill={z.color ?? "#4ade80"}
                    fontSize={Math.min(z.width, z.depth) > 8 ? 2.5 : 1.8}
                    fontFamily="var(--font-display)"
                  >
                    {z.name}
                  </text>
                  {/* Shadow/sun indicator */}
                  {displayShadows && displayShadows.length > 0 && (
                    <circle
                      cx={z.posX + z.width - 1.5}
                      cy={z.posY + 1.5}
                      r={1.2}
                      fill={inShadow ? "#6b7280" : "#facc15"}
                      opacity={0.8}
                    />
                  )}
                </g>
              );
            })}

            {/* Shadow polygons */}
            {displayShadows?.map((shadow, idx) => (
              <polygon
                key={`shadow-${shadow.structureId}-${idx}`}
                points={shadow.polygon
                  .map((p) => `${p.x},${p.y}`)
                  .join(" ")}
                fill="rgba(15, 23, 42, 0.35)"
                stroke="rgba(30, 58, 138, 0.2)"
                strokeWidth={0.3}
              />
            ))}

            {/* Loading indicator */}
            {shadowsFetching && (
              <rect
                x={0}
                y={0}
                width={lotW}
                height={lotD}
                fill="rgba(0,0,0,0.05)"
                className="animate-pulse"
              />
            )}
          </svg>

          {/* Width label */}
          <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-xs text-stone-500 font-mono">
            {lotW}ft
          </span>
          {/* Depth label */}
          <span className="absolute -right-12 top-1/2 -translate-y-1/2 text-xs text-stone-500 font-mono rotate-90">
            {lotD}ft
          </span>
        </div>
      </div>

      {shadowsError && (
        <div className="text-center py-3">
          <p className="text-xs text-stone-500 font-mono">
            Shadow data unavailable -- showing lot map without shadow overlay
          </p>
        </div>
      )}

      {/* Zone Sun Exposure Analysis */}
      {zones.length > 0 && displayShadows && displayShadows.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold font-display text-stone-300 uppercase tracking-wider mb-3">
            Zone Shadow Status
          </h3>
          <p className="text-xs text-stone-500 font-mono mb-3">
            At {sliderMinutes != null ? formatTimeFromMinutes(sliderMinutes) : "--"} on{" "}
            {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {zones
              .filter((z) => !z.isIndoor)
              .map((zone) => {
                const inShadow = zonesInShadow.has(zone.id);
                return (
                  <Card key={zone.id}>
                    <div className="flex items-start gap-3">
                      <div
                        className="w-3 h-3 rounded-sm mt-0.5 shrink-0"
                        style={{
                          backgroundColor: zone.color ?? "#4ade80",
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-stone-200 font-display truncate">
                          {zone.name}
                        </p>
                        <p
                          className={`text-xs font-mono mt-0.5 ${
                            inShadow ? "text-stone-400" : "text-yellow-400"
                          }`}
                        >
                          {inShadow ? "In Shadow" : "In Sun"}
                        </p>
                        {zone.sunExposure && (
                          <p className="text-[10px] text-stone-500 font-mono mt-1">
                            Manual:{" "}
                            {zone.sunExposure.replace("_", " ")}
                          </p>
                        )}
                      </div>
                      <Sun
                        size={16}
                        className={
                          inShadow ? "text-stone-600" : "text-yellow-400"
                        }
                      />
                    </div>
                  </Card>
                );
              })}
          </div>
        </div>
      )}

      {/* Seasonal Comparison */}
      <div>
        <h3 className="text-sm font-semibold font-display text-stone-300 uppercase tracking-wider mb-3">
          Seasonal Comparison
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(
            [
              "Winter Solstice",
              "Spring Equinox",
              "Summer Solstice",
              "Fall Equinox",
            ] as const
          ).map((season) => (
            <SeasonCard
              key={season}
              label={season}
              locationId={locationId}
              isCurrent={currentSeason === season}
              onSelect={() => handleDatePreset(season)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------- Season Card ----------

function SeasonCard({
  label,
  locationId,
  isCurrent,
  onSelect,
}: {
  label: string;
  locationId: number;
  isCurrent: boolean;
  onSelect: () => void;
}) {
  const date = getSeasonDate(label);
  const { data: sunData } = useSunDataForDate(locationId, date);

  const shortLabel = label.split(" ")[0]; // "Winter", "Spring", etc.
  const icon =
    label.includes("Winter")
      ? "snowflake"
      : label.includes("Summer")
        ? "sun"
        : label.includes("Spring")
          ? "sprout"
          : "leaf";

  return (
    <button
      onClick={onSelect}
      className={`p-3 rounded-xl text-left transition-all ${
        isCurrent
          ? "bg-emerald-500/10 border border-emerald-500/30 ring-1 ring-emerald-500/20"
          : "bg-stone-900 border border-stone-800 hover:border-stone-700"
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs">
          {icon === "snowflake"
            ? "\u2744\uFE0F"
            : icon === "sun"
              ? "\u2600\uFE0F"
              : icon === "sprout"
                ? "\uD83C\uDF31"
                : "\uD83C\uDF42"}
        </span>
        <span
          className={`text-xs font-semibold font-display ${
            isCurrent ? "text-emerald-400" : "text-stone-300"
          }`}
        >
          {shortLabel}
        </span>
        {isCurrent && (
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono">
            NOW
          </span>
        )}
      </div>
      {sunData ? (
        <div className="space-y-0.5 text-[10px] font-mono">
          <p className="text-stone-400">
            Rise: {formatTime(sunData.sunrise)}
          </p>
          <p className="text-stone-400">
            Set: {formatTime(sunData.sunset)}
          </p>
          <p className="text-stone-200 text-xs mt-1">
            {sunData.dayLength}
          </p>
        </div>
      ) : (
        <div className="h-12 bg-stone-800 rounded animate-pulse" />
      )}
    </button>
  );
}
