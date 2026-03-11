import type { PlantType, PlantMood, PlantStatus } from "../../api";
import { getSpriteType } from "../../api";

export interface PlantSpriteProps {
  type: PlantType;
  mood: PlantMood;
  size?: number;
  className?: string;
  showOverlay?: boolean;
  status?: PlantStatus;
}

// CSS filter strings for mood-based tinting
const moodFilters: Record<PlantMood, string> = {
  happy: "none",
  new: "none",
  thirsty: "sepia(0.3) saturate(0.6)",
  cold: "hue-rotate(180deg) saturate(0.7)",
  hot: "hue-rotate(-30deg) sepia(0.2)",
  wilting: "sepia(0.6) saturate(0.4) brightness(0.8)",
  sleeping: "brightness(0.5) saturate(0.5)",
};

export default function PlantSprite({
  type,
  mood,
  size = 64,
  className,
  showOverlay = true,
  status,
}: PlantSpriteProps) {
  const scale = size / 16;
  const resolvedType = getSpriteType(type);

  // Opacity: planned status → 0.75, sleeping mood → 0.7, else 1
  const opacity = status === "planned" ? 0.75 : mood === "sleeping" ? 0.7 : 1;

  return (
    <span className={className} style={{ display: "inline-block", position: "relative" }}>
      <img
        src={`/sprites/plants/${resolvedType}.png`}
        alt={`${type} plant feeling ${mood}`}
        width={size}
        height={size}
        style={{
          imageRendering: "pixelated",
          opacity,
          filter: moodFilters[mood],
          display: "block",
        }}
      />

      {/* Mood overlays */}
      {showOverlay && (mood === "happy" || mood === "new" || mood === "thirsty" || mood === "hot" || mood === "sleeping") && (
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            pointerEvents: "none",
          }}
        >
          {mood === "happy" && (
            <>
              <rect x={12 * scale} y={3 * scale} width={scale * 0.5} height={scale * 0.5} fill="#facc15" />
              <rect x={13 * scale} y={2 * scale} width={scale * 0.5} height={scale * 0.5} fill="#facc15" />
              <rect x={14 * scale} y={3.5 * scale} width={scale * 0.5} height={scale * 0.5} fill="#facc15" />
            </>
          )}

          {mood === "new" && (
            <>
              <rect x={12 * scale} y={2 * scale} width={scale * 0.6} height={scale * 0.6} fill="#34d399" />
              <rect x={13.5 * scale} y={4 * scale} width={scale * 0.4} height={scale * 0.4} fill="#6ee7b7" />
              <rect x={2 * scale} y={3 * scale} width={scale * 0.5} height={scale * 0.5} fill="#34d399" />
              <rect x={1 * scale} y={5 * scale} width={scale * 0.4} height={scale * 0.4} fill="#6ee7b7" />
            </>
          )}

          {mood === "thirsty" && (
            <>
              <rect x={12 * scale} y={8 * scale} width={scale * 0.8} height={scale * 1.2} fill="#60a5fa" rx={scale * 0.3} />
              <rect x={13.5 * scale} y={10 * scale} width={scale * 0.6} height={scale * 0.9} fill="#93c5fd" rx={scale * 0.2} />
            </>
          )}

          {mood === "hot" && (
            <>
              <rect x={13 * scale} y={4 * scale} width={scale * 0.4} height={scale * 2} fill="#f97316" opacity={0.6} />
              <rect x={14 * scale} y={5 * scale} width={scale * 0.4} height={scale * 1.5} fill="#fb923c" opacity={0.5} />
              <rect x={1 * scale} y={5 * scale} width={scale * 0.4} height={scale * 1.8} fill="#f97316" opacity={0.6} />
            </>
          )}

          {mood === "sleeping" && (
            <>
              <text x={11 * scale} y={4 * scale} fontSize={scale * 2} fill="#a8a29e" fontFamily="monospace">z</text>
              <text x={12.5 * scale} y={2.5 * scale} fontSize={scale * 1.5} fill="#78716c" fontFamily="monospace">z</text>
            </>
          )}
        </svg>
      )}
    </span>
  );
}

const happyMessages = [
  "Life is good!",
  "I'm thriving over here!",
  "Feeling fantastic today!",
  "Sun's out, leaves out!",
  "Photosynthesis is *chef's kiss*",
];

const thirstyMessages = [
  "Could use a drink...",
  "Getting a bit parched!",
  "Water me? Pretty please?",
  "My soil is looking dusty...",
];

const coldMessages = [
  "Brr, it's chilly!",
  "Can someone grab me a blanket?",
  "Is it frost season already?!",
  "I'm shivering over here!",
];

const hotMessages = [
  "Whew, it's toasty!",
  "I need some shade!",
  "Melting... literally melting...",
  "Who turned up the thermostat?",
];

const wiltingMessages = [
  "I'm not feeling so great...",
  "Help! I need attention!",
  "Things have been better...",
  "SOS! Plant down!",
];

const sleepingMessages = [
  "Zzz...",
  "Shhh, I'm resting...",
  "Dormancy is self-care.",
  "*snores in chlorophyll*",
];

const newMessages = [
  "Hi! I'm new here!",
  "Nice to meet you!",
  "Just planted, feeling great!",
  "First day in the garden!",
];

const moodMessageMap: Record<PlantMood, string[]> = {
  happy: happyMessages,
  thirsty: thirstyMessages,
  cold: coldMessages,
  hot: hotMessages,
  wilting: wiltingMessages,
  sleeping: sleepingMessages,
  new: newMessages,
};

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

export function getMoodMessage(mood: PlantMood, nickname?: string): string {
  const messages = moodMessageMap[mood] ?? happyMessages;
  const seed = (nickname ?? "plant") + new Date().getHours();
  const index = hashCode(seed) % messages.length;
  const msg = messages[index] ?? messages[0]!;
  if (nickname) {
    const personalPrefixes: Record<PlantMood, string> = {
      happy: `I'm ${nickname} and I'm thriving!`,
      thirsty: `${nickname} here... could use a drink!`,
      cold: `${nickname} is freezing!`,
      hot: `${nickname} needs shade ASAP!`,
      wilting: `${nickname} needs help...`,
      sleeping: `${nickname} is resting... zzz`,
      new: `Hi! I'm ${nickname}, nice to meet you!`,
    };
    // Use deterministic selection for personalized vs generic
    if (hashCode(seed + "personal") % 2 === 0) {
      return personalPrefixes[mood] ?? msg;
    }
  }
  return msg;
}
