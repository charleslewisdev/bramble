/**
 * Speech bubble system for the garden map.
 * Randomly pops up short quips above plant sprites based on their mood/status.
 * Renders using PixiJS Graphics + Text for a pixelated aesthetic.
 */

import { Container, Graphics, Text, TextStyle } from "pixi.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PlantAnimInfo {
  sprite: { x: number; y: number; width: number; height: number };
  plant: {
    id: number;
    nickname?: string | null;
    mood?: string | null;
    status?: string | null;
  };
  baseX: number;
  baseY: number;
}

interface ActiveBubble {
  container: Container;
  plantId: number;
  /** World-space center X of the bubble (used for overlap checks) */
  worldX: number;
  /** World-space top Y of the bubble */
  worldY: number;
  /** Seconds the bubble has been alive */
  age: number;
  /** Total display duration (fade-in + hold + fade-out) */
  duration: number;
  /** Fade-in duration */
  fadeIn: number;
  /** Fade-out duration */
  fadeOut: number;
}

// ---------------------------------------------------------------------------
// Phrase dictionaries
// ---------------------------------------------------------------------------

const phrases: Record<string, string[]> = {
  happy: [
    "Life is good!",
    "Sun's out, leaves out!",
    "Photosynthesis is *chef's kiss*",
    "I'm thriving over here!",
    "Feeling fantastic today!",
    "Best. Soil. Ever.",
    "Living my best leaf life",
    "10/10 would photosynthesize again",
    "This is the good stuff",
    "Peak growing season energy",
    "Just vibing in the sun",
    "Root system? Thriving.",
    "I woke up like this",
    "Garden goals achieved",
    "Alexa, play Here Comes the Sun",
  ],
  thirsty: [
    "Could use a drink...",
    "Getting a bit parched!",
    "Water me? Pretty please?",
    "My soil is looking dusty...",
    "Is it raining yet?",
    "*taps roots impatiently*",
    "H2O? More like H2-NO...",
    "I'm drying up over here",
    "Send water, not thoughts & prayers",
    "Day 3 without water...",
    "My leaves are crunchy",
    "Moisture level: concerning",
  ],
  cold: [
    "Brr, it's chilly!",
    "Can someone grab me a blanket?",
    "Is it frost season already?!",
    "I'm shivering over here!",
    "My roots are frozen!",
    "This is NOT my zone...",
    "Where's the greenhouse?",
    "I didn't sign up for winter",
    "Frost advisory: ME",
    "Can't feel my leaves",
    "Hardiness zone? More like HARDLY zone",
  ],
  hot: [
    "Whew, it's toasty!",
    "I need some shade!",
    "Melting... literally melting...",
    "Who turned up the thermostat?",
    "SPF 5000 please",
    "This is fine. Everything is fine.",
    "Am I being roasted?",
    "Sun is NOT a gentle friend today",
    "My leaves are sunburned",
    "Too hot to photosynthesize",
    "Sweat? I wish I could",
  ],
  wilting: [
    "I'm not feeling so great...",
    "Help! I need attention!",
    "Things have been better...",
    "SOS! Plant down!",
    "Send the gardener!",
    "I've seen better days...",
    "Struggling but still here",
    "A little TLC would go a long way",
    "Don't give up on me!",
    "I'm trying my best...",
    "Plot twist: I need help",
  ],
  sleeping: [
    "Zzz...",
    "Shhh, I'm resting...",
    "Dormancy is self-care.",
    "*snores in chlorophyll*",
    "Wake me in spring...",
    "Do not disturb",
    "Hibernation mode: ON",
    "Beauty sleep in progress",
    "Gone dormant, back later",
    "Out of office until spring",
  ],
  new: [
    "Hi! I'm new here!",
    "Nice to meet you!",
    "Just planted, feeling great!",
    "First day in the garden!",
    "Where's the welcome committee?",
    "Putting down roots!",
    "New plant, who dis?",
    "Still finding my roots",
    "Hello, neighbors!",
    "Ready to grow!",
  ],
};

const genericPhrases: string[] = [
  "I wonder what's for dinner... oh right, sunlight",
  "The birds are nice but do they have to sit on me?",
  "Worm buddy says hi!",
  "I can see the house from here",
  "Is that a butterfly? Hi butterfly!",
  "My neighbor is looking good today",
  "I love rain days",
  "Wind is doing my hair today",
  "Bee friend visited!",
  "Growing is my cardio",
  "Does anyone else hear the sprinkler?",
  "Plot 2, checking in",
  "Another beautiful day in the garden",
  "The soil here is chef's kiss",
  "Do I look taller? I feel taller.",
  "Just grew a new leaf!",
  "That cloud looks like a watering can",
  "*stretches toward sun*",
  "Compost tea is my favorite",
  "Mulch game strong",
];

const nicknamePhrases: string[] = [
  "They call me {name}!",
  "{name}, reporting for duty",
  "It's me, {name}!",
  "{name} says hello!",
  "The one and only {name}",
  "{name}: living legend",
  "Yeah, I'm {name}. Big deal.",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MAX_VISIBLE = 3;
const SPAWN_MIN = 6; // seconds
const SPAWN_MAX = 12;
const HOLD_MIN = 3;
const HOLD_MAX = 4;
const FADE_DURATION = 0.4; // seconds for fade-in and fade-out each
const BUBBLE_PAD_X = 6;
const BUBBLE_PAD_Y = 4;
const BUBBLE_MAX_WIDTH = 120;
const TAIL_SIZE = 4;
const FONT_SIZE = 8;
const OVERLAP_DISTANCE = 50; // minimum px between bubble centers

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

/** Simple word-wrap that respects max width (character-count heuristic). */
function wrapText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;

  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (test.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// SpeechBubbleManager
// ---------------------------------------------------------------------------

export class SpeechBubbleManager {
  private parent: Container;
  private bubbleLayer: Container;
  private plants: PlantAnimInfo[] = [];
  private activeBubbles: ActiveBubble[] = [];
  private spawnTimer = 0;
  private nextSpawnDelay: number;
  /** Track recently-used phrases per plant to avoid repeats */
  private recentPhrases = new Map<number, Set<string>>();
  private readonly maxRecent = 5;

  constructor(parent: Container) {
    this.parent = parent;
    this.bubbleLayer = new Container();
    this.bubbleLayer.label = "speech-bubbles";
    this.bubbleLayer.zIndex = 999;
    this.parent.addChild(this.bubbleLayer);
    this.nextSpawnDelay = randomBetween(SPAWN_MIN, SPAWN_MAX);
  }

  /** Update the list of plants available for speech bubbles. */
  setPlants(plants: PlantAnimInfo[]): void {
    this.plants = plants;
  }

  /** Called every frame from the animation loop. `dt` is in seconds. */
  update(dt: number): void {
    if (this.plants.length === 0) return;

    // Age and cull existing bubbles
    for (let i = this.activeBubbles.length - 1; i >= 0; i--) {
      const bubble = this.activeBubbles[i]!;
      bubble.age += dt;

      // Compute alpha based on lifecycle phase
      const alpha = this.computeAlpha(bubble);
      bubble.container.alpha = alpha;

      if (bubble.age >= bubble.duration) {
        this.bubbleLayer.removeChild(bubble.container);
        bubble.container.destroy({ children: true });
        this.activeBubbles.splice(i, 1);
      }
    }

    // Try to spawn new bubbles
    this.spawnTimer += dt;
    if (this.spawnTimer >= this.nextSpawnDelay) {
      this.spawnTimer = 0;
      this.nextSpawnDelay = randomBetween(SPAWN_MIN, SPAWN_MAX);

      if (this.activeBubbles.length < MAX_VISIBLE) {
        this.trySpawnBubble();
      }
    }
  }

  /** Clean up all resources. */
  destroy(): void {
    for (const bubble of this.activeBubbles) {
      bubble.container.destroy({ children: true });
    }
    this.activeBubbles = [];
    this.parent.removeChild(this.bubbleLayer);
    this.bubbleLayer.destroy({ children: true });
    this.recentPhrases.clear();
  }

  // ---- Private ----

  private computeAlpha(bubble: ActiveBubble): number {
    const { age, duration, fadeIn, fadeOut } = bubble;
    if (age < fadeIn) {
      return age / fadeIn;
    }
    const fadeOutStart = duration - fadeOut;
    if (age > fadeOutStart) {
      return Math.max(0, 1 - (age - fadeOutStart) / fadeOut);
    }
    return 1;
  }

  private trySpawnBubble(): void {
    // Pick a plant that doesn't already have an active bubble
    const activePlantIds = new Set(this.activeBubbles.map((b) => b.plantId));
    const candidates = this.plants.filter(
      (p) => !activePlantIds.has(p.plant.id),
    );

    if (candidates.length === 0) return;

    const plant = pickRandom(candidates);
    const phrase = this.selectPhrase(plant);
    if (!phrase) return;

    // Compute bubble position (centered above the sprite)
    const spriteW =
      "width" in plant.sprite ? plant.sprite.width : 32 * 1.25;
    const bubbleX = plant.sprite.x + spriteW / 2;
    const bubbleY = plant.sprite.y - 8; // above the sprite top

    // Check for overlap with existing bubbles
    for (const existing of this.activeBubbles) {
      const dx = bubbleX - existing.worldX;
      const dy = bubbleY - existing.worldY;
      if (Math.sqrt(dx * dx + dy * dy) < OVERLAP_DISTANCE) {
        return; // too close, skip this spawn
      }
    }

    // Create the bubble
    const hold = randomBetween(HOLD_MIN, HOLD_MAX);
    const duration = FADE_DURATION + hold + FADE_DURATION;

    const container = this.createBubbleGraphics(phrase, bubbleX, bubbleY);
    container.alpha = 0;
    this.bubbleLayer.addChild(container);

    this.activeBubbles.push({
      container,
      plantId: plant.plant.id,
      worldX: bubbleX,
      worldY: bubbleY,
      age: 0,
      duration,
      fadeIn: FADE_DURATION,
      fadeOut: FADE_DURATION,
    });

    // Track this phrase as recently used for this plant
    this.trackPhrase(plant.plant.id, phrase);
  }

  private selectPhrase(plant: PlantAnimInfo): string | null {
    const roll = Math.random();
    const recent = this.recentPhrases.get(plant.plant.id) ?? new Set();

    let phrase: string | null = null;

    if (roll < 0.1 && plant.plant.nickname) {
      // 10%: nickname phrase
      const template = pickRandom(nicknamePhrases);
      phrase = template.replace("{name}", plant.plant.nickname);
    } else if (roll < 0.3) {
      // 20%: generic phrase
      phrase = this.pickUnused(genericPhrases, recent);
    } else {
      // 70%: mood-specific
      const mood = plant.plant.mood ?? "happy";
      const moodPhrases = phrases[mood] ?? phrases["happy"]!;
      phrase = this.pickUnused(moodPhrases, recent);
    }

    return phrase;
  }

  /** Pick a phrase not in the recent set, falling back to any if all are used. */
  private pickUnused(pool: string[], recent: Set<string>): string {
    const available = pool.filter((p) => !recent.has(p));
    if (available.length > 0) {
      return pickRandom(available);
    }
    return pickRandom(pool);
  }

  private trackPhrase(plantId: number, phrase: string): void {
    let recent = this.recentPhrases.get(plantId);
    if (!recent) {
      recent = new Set();
      this.recentPhrases.set(plantId, recent);
    }
    recent.add(phrase);
    // Evict oldest if over limit (Sets iterate in insertion order)
    if (recent.size > this.maxRecent) {
      const first = recent.values().next().value;
      if (first !== undefined) recent.delete(first);
    }
  }

  private createBubbleGraphics(
    phrase: string,
    centerX: number,
    bottomY: number,
  ): Container {
    const container = new Container();

    // Wrap text to fit max width
    // Approximate chars that fit: ~2 chars per px at 8px font, monospace
    const maxChars = Math.floor(BUBBLE_MAX_WIDTH / (FONT_SIZE * 0.55));
    const wrappedText = wrapText(phrase, maxChars);

    const textStyle = new TextStyle({
      fontFamily: "monospace",
      fontSize: FONT_SIZE,
      fill: 0xffffff,
      wordWrap: true,
      wordWrapWidth: BUBBLE_MAX_WIDTH - BUBBLE_PAD_X * 2,
      lineHeight: FONT_SIZE + 2,
    });

    const text = new Text({ text: wrappedText, style: textStyle });
    text.anchor.set(0.5, 1);

    const bgWidth = Math.min(
      BUBBLE_MAX_WIDTH,
      text.width + BUBBLE_PAD_X * 2,
    );
    const bgHeight = text.height + BUBBLE_PAD_Y * 2;

    // Position the bubble above the plant
    const bubbleBottom = bottomY;
    const bubbleTop = bubbleBottom - TAIL_SIZE - bgHeight;

    // Background rounded rectangle
    const bg = new Graphics();
    bg.roundRect(
      centerX - bgWidth / 2,
      bubbleTop,
      bgWidth,
      bgHeight,
      3,
    );
    bg.fill({ color: 0x1a1a2e, alpha: 0.85 });

    // Tail triangle pointing down
    const tail = new Graphics();
    tail.moveTo(centerX - TAIL_SIZE, bubbleTop + bgHeight);
    tail.lineTo(centerX, bubbleTop + bgHeight + TAIL_SIZE);
    tail.lineTo(centerX + TAIL_SIZE, bubbleTop + bgHeight);
    tail.closePath();
    tail.fill({ color: 0x1a1a2e, alpha: 0.85 });

    // Position text centered in bubble
    text.x = centerX;
    text.y = bubbleTop + bgHeight - BUBBLE_PAD_Y;

    container.addChild(bg);
    container.addChild(tail);
    container.addChild(text);

    return container;
  }
}
