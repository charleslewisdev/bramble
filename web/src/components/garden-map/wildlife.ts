/**
 * Animated garden critters for the garden map.
 * Spawns butterflies, bees, birds, ladybugs, fireflies, and toads
 * based on season, time of day, and weather conditions.
 */

import { Container, Graphics } from "pixi.js";

export interface WildlifeConfig {
  season: "spring" | "summer" | "fall" | "winter";
  timeOfDay: "night" | "dawn" | "day" | "dusk";
  isRaining: boolean;
}

type CritterType =
  | "butterfly"
  | "bee"
  | "bird"
  | "ladybug"
  | "firefly"
  | "toad";

interface Critter {
  type: CritterType;
  graphics: Graphics;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Accumulated time for animation and movement */
  age: number;
  /** Total lifetime in seconds */
  lifetime: number;
  /** Animation frame (0 or 1) */
  frame: number;
  /** Frame timer for flap/pulse animations */
  frameTimer: number;
  /** Critter-specific color */
  color: number;
  /** Current alpha (for fade in/out) */
  alpha: number;
  /** Bee: target hover point */
  targetX: number;
  targetY: number;
  /** Toad: time until next hop */
  hopTimer: number;
}

const MAX_CRITTERS = 5;
const SPAWN_INTERVAL_MIN = 3;
const SPAWN_INTERVAL_MAX = 5;
const LIFETIME_MIN = 15;
const LIFETIME_MAX = 30;

const BUTTERFLY_COLORS = [0xffcc33, 0xff8833, 0xaa55cc, 0xeeeedd];
const FIREFLY_COLOR = 0xffee88;

/** Which critters can appear for a given season + time combination */
function getValidCritters(config: WildlifeConfig): CritterType[] {
  const { season, timeOfDay, isRaining } = config;
  const types: CritterType[] = [];

  const isDaytime = timeOfDay === "day" || timeOfDay === "dawn";
  const isNight = timeOfDay === "night";
  const isDusk = timeOfDay === "dusk";
  const isWarm = season === "spring" || season === "summer";

  if (isDaytime && isWarm && !isRaining) {
    types.push("butterfly", "bee");
  }
  if (isDaytime && isWarm) {
    types.push("ladybug");
  }
  if (isDaytime) {
    // Birds appear all seasons, but rarely in winter
    if (season !== "winter" || Math.random() < 0.3) {
      types.push("bird");
    }
  }
  if ((isNight || isDusk) && season !== "winter") {
    types.push("firefly");
  }
  if (isDusk || isNight) {
    types.push("toad");
  }

  return types;
}

// --------------- Drawing functions ---------------

function drawButterfly(g: Graphics, frame: number, color: number): void {
  g.clear();
  // body
  g.rect(3, 2, 2, 4).fill(0x333333);
  if (frame === 0) {
    // wings open
    g.ellipse(1, 3, 2, 3).fill(color);
    g.ellipse(7, 3, 2, 3).fill(color);
  } else {
    // wings half closed
    g.ellipse(2, 3, 1, 2).fill(color);
    g.ellipse(6, 3, 1, 2).fill(color);
  }
}

function drawBee(g: Graphics): void {
  g.clear();
  // yellow body
  g.ellipse(4, 4, 3, 2).fill(0xddbb22);
  // black stripes
  g.rect(3, 3, 1, 2).fill(0x222222);
  g.rect(5, 3, 1, 2).fill(0x222222);
  // wings (tiny translucent)
  g.ellipse(3, 2, 1.5, 1).fill({ color: 0xffffff, alpha: 0.5 });
  g.ellipse(5, 2, 1.5, 1).fill({ color: 0xffffff, alpha: 0.5 });
}

function drawBird(g: Graphics, frame: number): void {
  g.clear();
  if (frame === 0) {
    // V-shape in flight
    g.moveTo(0, 2).lineTo(3, 0).lineTo(4, 1).stroke({ color: 0x444444, width: 1.2 });
    g.moveTo(4, 1).lineTo(5, 0).lineTo(8, 2).stroke({ color: 0x444444, width: 1.2 });
  } else {
    // Wings slightly lower
    g.moveTo(0, 1).lineTo(3, 1).lineTo(4, 1).stroke({ color: 0x444444, width: 1.2 });
    g.moveTo(4, 1).lineTo(5, 1).lineTo(8, 1).stroke({ color: 0x444444, width: 1.2 });
  }
}

function drawLadybug(g: Graphics): void {
  g.clear();
  // red body
  g.circle(3, 3, 3).fill(0xcc2222);
  // black spots
  g.circle(2, 2, 0.8).fill(0x111111);
  g.circle(4, 2, 0.8).fill(0x111111);
  g.circle(3, 4, 0.8).fill(0x111111);
  // head
  g.circle(3, 0, 1.2).fill(0x111111);
  // center line
  g.moveTo(3, 0).lineTo(3, 6).stroke({ color: 0x111111, width: 0.5 });
}

function drawFirefly(g: Graphics, alpha: number): void {
  g.clear();
  // glow halo
  g.circle(4, 4, 4).fill({ color: FIREFLY_COLOR, alpha: alpha * 0.3 });
  // bright center
  g.circle(4, 4, 1.5).fill({ color: FIREFLY_COLOR, alpha });
}

function drawToad(g: Graphics): void {
  g.clear();
  // body
  g.ellipse(4, 4, 3, 2.5).fill(0x667744);
  // eyes
  g.circle(2, 2, 1).fill(0x334422);
  g.circle(6, 2, 1).fill(0x334422);
}

// --------------- Main system ---------------

export class WildlifeSystem {
  private critters: Critter[] = [];
  private container: Container;
  private critterContainer: Container;
  private mapWidth: number;
  private mapHeight: number;

  private config: WildlifeConfig = {
    season: "spring",
    timeOfDay: "day",
    isRaining: false,
  };

  private spawnTimer: number;

  constructor(container: Container, mapWidth: number, mapHeight: number) {
    this.mapWidth = mapWidth;
    this.mapHeight = mapHeight;
    this.container = container;

    this.critterContainer = new Container();
    this.critterContainer.zIndex = 997;
    container.addChild(this.critterContainer);

    // Randomize initial spawn timer
    this.spawnTimer =
      SPAWN_INTERVAL_MIN +
      Math.random() * (SPAWN_INTERVAL_MAX - SPAWN_INTERVAL_MIN);
  }

  configure(config: WildlifeConfig): void {
    const changed =
      this.config.season !== config.season ||
      this.config.timeOfDay !== config.timeOfDay ||
      this.config.isRaining !== config.isRaining;

    this.config = { ...config };

    if (changed) {
      // Remove critters that are no longer valid for the new conditions
      const valid = getValidCritters(this.config);
      for (let i = this.critters.length - 1; i >= 0; i--) {
        const c = this.critters[i]!;
        if (!valid.includes(c.type)) {
          this.removeCritter(i);
        }
      }
    }
  }

  update(dt: number): void {
    // Spawn timer
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer =
        SPAWN_INTERVAL_MIN +
        Math.random() * (SPAWN_INTERVAL_MAX - SPAWN_INTERVAL_MIN);

      // Reduce spawn rate in rain
      if (this.config.isRaining) {
        this.spawnTimer *= 2;
      }

      if (this.critters.length < MAX_CRITTERS) {
        this.trySpawn();
      }
    }

    // Update each critter
    for (let i = this.critters.length - 1; i >= 0; i--) {
      const c = this.critters[i]!;
      c.age += dt;

      // Fade in (first 1s) and fade out (last 2s)
      if (c.age < 1) {
        c.alpha = c.age;
      } else if (c.age > c.lifetime - 2) {
        c.alpha = Math.max(0, (c.lifetime - c.age) / 2);
      } else {
        c.alpha = 1;
      }

      // Remove expired critters
      if (c.age >= c.lifetime) {
        this.removeCritter(i);
        continue;
      }

      // Movement per type
      this.updateCritter(c, dt);

      // Animation frame timer
      c.frameTimer += dt;
      const frameInterval = c.type === "bird" ? 0.3 : 0.4;
      if (c.frameTimer >= frameInterval) {
        c.frameTimer -= frameInterval;
        c.frame = c.frame === 0 ? 1 : 0;
      }

      // Redraw sprite
      this.drawCritter(c);

      // Position the graphics
      c.graphics.x = c.x;
      c.graphics.y = c.y;
      c.graphics.alpha = c.alpha;
    }
  }

  destroy(): void {
    this.critterContainer.destroy({ children: true });
    this.critters.length = 0;
  }

  // --------------- internal ---------------

  private trySpawn(): void {
    const valid = getValidCritters(this.config);
    if (valid.length === 0) return;

    const type = valid[Math.floor(Math.random() * valid.length)]!;
    const g = new Graphics();
    this.critterContainer.addChild(g);

    const w = this.mapWidth;
    const h = this.mapHeight;

    const critter: Critter = {
      type,
      graphics: g,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      age: 0,
      lifetime:
        LIFETIME_MIN + Math.random() * (LIFETIME_MAX - LIFETIME_MIN),
      frame: 0,
      frameTimer: 0,
      color: 0xffffff,
      alpha: 0,
      targetX: Math.random() * w,
      targetY: Math.random() * h,
      hopTimer: 3 + Math.random() * 5,
    };

    // Type-specific initialization
    switch (type) {
      case "butterfly":
        critter.x = Math.random() * w;
        critter.y = Math.random() * h * 0.6;
        critter.vx = (Math.random() - 0.5) * 0.8;
        critter.vy = 0;
        critter.color =
          BUTTERFLY_COLORS[
            Math.floor(Math.random() * BUTTERFLY_COLORS.length)
          ]!;
        break;
      case "bee":
        critter.x = Math.random() * w;
        critter.y = Math.random() * h * 0.7;
        critter.targetX = critter.x;
        critter.targetY = critter.y;
        break;
      case "bird":
        // Enter from left or right edge
        if (Math.random() > 0.5) {
          critter.x = -10;
          critter.vx = 1 + Math.random();
        } else {
          critter.x = w + 10;
          critter.vx = -(1 + Math.random());
        }
        critter.y = Math.random() * h * 0.4;
        critter.vy = (Math.random() - 0.5) * 0.3;
        break;
      case "ladybug":
        critter.x = Math.random() * w;
        critter.y = h * 0.7 + Math.random() * h * 0.3;
        critter.vx = (Math.random() > 0.5 ? 1 : -1) * 0.1;
        critter.vy = 0;
        break;
      case "firefly":
        critter.x = Math.random() * w;
        critter.y = Math.random() * h * 0.8;
        critter.vx = (Math.random() - 0.5) * 0.3;
        critter.vy = (Math.random() - 0.5) * 0.3;
        critter.color = FIREFLY_COLOR;
        break;
      case "toad":
        critter.x = Math.random() * w;
        critter.y = h * 0.6 + Math.random() * h * 0.35;
        critter.vx = 0;
        critter.vy = 0;
        break;
    }

    this.critters.push(critter);
  }

  private updateCritter(c: Critter, dt: number): void {
    const w = this.mapWidth;
    const h = this.mapHeight;

    switch (c.type) {
      case "butterfly": {
        // Gentle sine-wave drift
        c.x += (0.3 + Math.random() * 0.2) * (c.vx > 0 ? 1 : -1) * dt * 60;
        c.y += Math.sin(c.age * 2) * 0.5 * dt * 60;
        // Wrap horizontally
        if (c.x > w + 10) c.x = -10;
        if (c.x < -10) c.x = w + 10;
        // Clamp vertical
        if (c.y < 0) c.y = 0;
        if (c.y > h * 0.8) c.y = h * 0.8;
        break;
      }
      case "bee": {
        // Hover in small circle near target, then dart to new target
        const dx = c.targetX - c.x;
        const dy = c.targetY - c.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 5) {
          // Hover in small circle
          c.x += Math.cos(c.age * 4) * 0.3 * dt * 60;
          c.y += Math.sin(c.age * 4) * 0.3 * dt * 60;

          // Occasionally pick new target
          if (Math.random() < 0.005) {
            c.targetX = Math.random() * w;
            c.targetY = Math.random() * h * 0.7;
          }
        } else {
          // Dart toward target
          const speed = 2;
          c.x += (dx / dist) * speed * dt * 60;
          c.y += (dy / dist) * speed * dt * 60;
        }
        break;
      }
      case "bird": {
        // Gentle curve across the map
        c.x += c.vx * dt * 60;
        c.y += c.vy * dt * 60;
        c.vy += (Math.random() - 0.5) * 0.01;
        c.vy = Math.max(-0.5, Math.min(0.5, c.vy));

        // If off-screen, expire early
        if (c.x > w + 30 || c.x < -30) {
          c.age = c.lifetime; // force removal
        }
        break;
      }
      case "ladybug": {
        // Slow crawl with occasional stops
        if (Math.sin(c.age * 0.5) > 0) {
          c.x += c.vx * dt * 60;
        }
        // Clamp to map
        if (c.x < 0) { c.x = 0; c.vx = Math.abs(c.vx); }
        if (c.x > w) { c.x = w; c.vx = -Math.abs(c.vx); }
        break;
      }
      case "firefly": {
        // Very slow random drift
        c.x += c.vx * dt * 60;
        c.y += c.vy * dt * 60;
        // Gentle direction changes
        c.vx += (Math.random() - 0.5) * 0.02;
        c.vy += (Math.random() - 0.5) * 0.02;
        c.vx = Math.max(-0.3, Math.min(0.3, c.vx));
        c.vy = Math.max(-0.3, Math.min(0.3, c.vy));
        // Keep in bounds
        if (c.x < 0 || c.x > w) c.vx *= -1;
        if (c.y < 0 || c.y > h) c.vy *= -1;
        break;
      }
      case "toad": {
        // Sit still, occasional hop
        c.hopTimer -= dt;
        if (c.hopTimer <= 0) {
          c.hopTimer = 3 + Math.random() * 5;
          // Quick hop to nearby position
          c.x += (Math.random() - 0.5) * 30;
          c.y += (Math.random() - 0.5) * 15;
          // Clamp
          c.x = Math.max(0, Math.min(w, c.x));
          c.y = Math.max(h * 0.5, Math.min(h, c.y));
        }
        break;
      }
    }
  }

  private drawCritter(c: Critter): void {
    switch (c.type) {
      case "butterfly":
        drawButterfly(c.graphics, c.frame, c.color);
        break;
      case "bee":
        drawBee(c.graphics);
        break;
      case "bird":
        drawBird(c.graphics, c.frame);
        break;
      case "ladybug":
        drawLadybug(c.graphics);
        break;
      case "firefly": {
        // Pulsing glow: alpha oscillates 0.2 - 1.0
        const pulse = 0.2 + Math.abs(Math.sin(c.age * 2.5)) * 0.8;
        drawFirefly(c.graphics, pulse);
        break;
      }
      case "toad":
        drawToad(c.graphics);
        break;
    }
  }

  private removeCritter(index: number): void {
    const c = this.critters[index]!;
    c.graphics.destroy();
    this.critters.splice(index, 1);
  }
}
