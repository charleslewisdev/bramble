/**
 * Weather particle system for the garden map.
 * Renders rain, snow, wind leaves, sun sparkles, overcast tint, and fog
 * based on live weather data. Also applies seasonal color tinting.
 */

import { Container, Graphics } from "pixi.js";

interface WeatherParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Length for rain, radius for others */
  size: number;
  alpha: number;
  color: number;
  /** Accumulated time for per-particle oscillation */
  age: number;
}

type WeatherType = "rain" | "snow" | "wind" | "sunny" | "fog" | null;

const MAX_PARTICLES = 100;

/** Seasonal tint colors (low-alpha overlays) */
const SEASON_TINTS: Record<string, number> = {
  spring: 0x44cc66, // warm green
  summer: 0xddaa22, // golden
  fall: 0xcc8833, // amber
  winter: 0x88aabb, // cool blue-white
};

function getSeason(month: number): string {
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "fall";
  return "winter";
}

function matchesCondition(conditions: string, ...keywords: string[]): boolean {
  const lower = conditions.toLowerCase();
  return keywords.some((k) => lower.includes(k));
}

export class WeatherEffectSystem {
  private particles: WeatherParticle[] = [];
  private pool: Graphics[] = [];
  private particleContainer: Container;
  private overlayGraphics: Graphics;
  private seasonGraphics: Graphics;

  private mapWidth: number;
  private mapHeight: number;

  private weatherType: WeatherType = null;
  private targetParticleCount = 0;
  private currentMonth = new Date().getMonth() + 1;
  private timeOfDay: "night" | "dawn" | "day" | "dusk" = "day";

  // Cached overlay state to avoid redrawing every frame
  private lastOverlayKey = "";

  constructor(container: Container, mapWidth: number, mapHeight: number) {
    this.mapWidth = mapWidth;
    this.mapHeight = mapHeight;

    // Season tint layer (behind everything)
    this.seasonGraphics = new Graphics();
    this.seasonGraphics.zIndex = -2;
    container.addChild(this.seasonGraphics);

    // Weather overlay layer (overcast / fog)
    this.overlayGraphics = new Graphics();
    this.overlayGraphics.zIndex = 998;
    container.addChild(this.overlayGraphics);

    // Particle container (on top)
    this.particleContainer = new Container();
    this.particleContainer.zIndex = 999;
    container.addChild(this.particleContainer);

    // Pre-allocate particle graphics pool
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const g = new Graphics();
      g.visible = false;
      this.particleContainer.addChild(g);
      this.pool.push(g);
    }
  }

  /** Update weather conditions based on API data */
  setWeather(conditions: string | null, temperature: number | null): void {
    const prev = this.weatherType;
    this.weatherType = null;
    this.targetParticleCount = 0;

    if (!conditions) {
      this.weatherType = null;
      this.targetParticleCount = 0;
    } else if (matchesCondition(conditions, "rain", "drizzle")) {
      this.weatherType = "rain";
      this.targetParticleCount = matchesCondition(conditions, "drizzle")
        ? 40
        : 80;
    } else if (matchesCondition(conditions, "snow")) {
      this.weatherType = "snow";
      this.targetParticleCount = 30 + Math.floor(Math.random() * 21);
    } else if (matchesCondition(conditions, "fog", "mist")) {
      this.weatherType = "fog";
      this.targetParticleCount = 0; // fog uses overlay, not particles
    } else if (
      matchesCondition(conditions, "clear", "sunny") ||
      (temperature != null && temperature > 70)
    ) {
      this.weatherType = "sunny";
      this.targetParticleCount = 5 + Math.floor(Math.random() * 6);
    }

    // If weather changed, clear old particles
    if (prev !== this.weatherType) {
      this.clearParticles();
    }

    this.rebuildOverlay();
  }

  setTimeOfDay(phase: "night" | "dawn" | "day" | "dusk"): void {
    if (this.timeOfDay !== phase) {
      this.timeOfDay = phase;
      this.rebuildOverlay();
    }
  }

  setSeason(month: number): void {
    if (this.currentMonth !== month) {
      this.currentMonth = month;
      this.rebuildSeasonOverlay();
    }
  }

  update(dt: number): void {
    // Spawn particles up to target count
    while (
      this.particles.length < this.targetParticleCount &&
      this.particles.length < MAX_PARTICLES
    ) {
      this.spawnParticle(true);
    }

    // Remove excess particles
    while (this.particles.length > this.targetParticleCount) {
      this.particles.pop();
    }

    // Update each particle
    const w = this.mapWidth;
    const h = this.mapHeight;

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i]!;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.age += dt;

      // Per-type behavior
      if (this.weatherType === "snow") {
        // Horizontal sway
        p.x += Math.sin(p.age * 1.5 + i) * 0.3;
      } else if (this.weatherType === "sunny") {
        // Sparkle: oscillate alpha
        p.alpha = 0.3 + Math.abs(Math.sin(p.age * 3)) * 0.7;
      }

      // Wrap around when off-screen
      if (p.y > h + 10) {
        p.y = -10;
        p.x = Math.random() * w;
      }
      if (p.x > w + 10) {
        p.x = -10;
        p.y = Math.random() * h;
      }
      if (p.x < -20) {
        p.x = w + 5;
        p.y = Math.random() * h;
      }

      // Draw into pooled Graphics
      const g = this.pool[i]!;
      g.visible = true;
      g.clear();

      if (this.weatherType === "rain") {
        // Diagonal 2px line
        g.moveTo(0, 0).lineTo(-1, p.size).stroke({ color: p.color, alpha: p.alpha, width: 1.5 });
      } else if (this.weatherType === "snow") {
        g.circle(0, 0, p.size).fill({ color: p.color, alpha: p.alpha });
      } else if (this.weatherType === "wind") {
        // Small leaf-like ellipse
        g.ellipse(0, 0, p.size, p.size * 0.4).fill({
          color: p.color,
          alpha: p.alpha,
        });
      } else if (this.weatherType === "sunny") {
        g.circle(0, 0, p.size).fill({ color: p.color, alpha: p.alpha });
      }

      g.x = p.x;
      g.y = p.y;
    }

    // Hide unused pool entries
    for (let i = this.particles.length; i < this.pool.length; i++) {
      this.pool[i]!.visible = false;
    }
  }

  destroy(): void {
    this.particleContainer.destroy({ children: true });
    this.overlayGraphics.destroy();
    this.seasonGraphics.destroy();
    this.particles.length = 0;
    this.pool.length = 0;
  }

  // --------------- internal ---------------

  private spawnParticle(randomY: boolean): void {
    const w = this.mapWidth;
    const h = this.mapHeight;
    let p: WeatherParticle;

    switch (this.weatherType) {
      case "rain":
        p = {
          x: Math.random() * (w + 40) - 20,
          y: randomY ? Math.random() * h : -10,
          vx: -30 - Math.random() * 20,
          vy: 180 + Math.random() * 60,
          size: 4 + Math.random() * 3,
          alpha: 0.4 + Math.random() * 0.3,
          color: Math.random() > 0.5 ? 0x6699cc : 0x88aadd,
          age: 0,
        };
        break;
      case "snow":
        p = {
          x: Math.random() * w,
          y: randomY ? Math.random() * h : -10,
          vx: (Math.random() - 0.5) * 10,
          vy: 15 + Math.random() * 20,
          size: 1.5 + Math.random() * 1.5,
          alpha: 0.6 + Math.random() * 0.4,
          color: 0xffffff,
          age: Math.random() * 6, // offset sway phase
        };
        break;
      case "wind":
        p = {
          x: randomY ? Math.random() * w : -10,
          y: Math.random() * h,
          vx: 60 + Math.random() * 40,
          vy: (Math.random() - 0.5) * 20,
          size: 2 + Math.random() * 2,
          alpha: 0.5 + Math.random() * 0.3,
          color: [0x7a9e3c, 0xa8c256, 0xc4a83e, 0x8b6e2f][
            Math.floor(Math.random() * 4)
          ]!,
          age: 0,
        };
        break;
      case "sunny":
        p = {
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 4,
          vy: -Math.random() * 5 - 2,
          size: 1 + Math.random(),
          alpha: 0.5,
          color: Math.random() > 0.5 ? 0xfacc15 : 0xfde68a,
          age: Math.random() * 6,
        };
        break;
      default:
        return;
    }

    this.particles.push(p);
  }

  private clearParticles(): void {
    this.particles.length = 0;
    for (const g of this.pool) {
      g.visible = false;
      g.clear();
    }
  }

  private rebuildOverlay(): void {
    const key = `${this.weatherType}_${this.timeOfDay}`;
    if (key === this.lastOverlayKey) return;
    this.lastOverlayKey = key;

    this.overlayGraphics.clear();
    const w = this.mapWidth;
    const h = this.mapHeight;

    if (this.weatherType === "fog") {
      // Semi-transparent white strips drifting (static representation)
      for (let i = 0; i < 6; i++) {
        const stripY = (h / 6) * i + Math.random() * 20;
        const stripH = 30 + Math.random() * 40;
        this.overlayGraphics
          .rect(0, stripY, w, stripH)
          .fill({ color: 0xdddddd, alpha: 0.15 + Math.random() * 0.1 });
      }
    }

    // Overcast: subtle gray tint (applies to overcast-ish conditions or when weather type is null with no clear sky)
    if (
      this.weatherType === "rain" ||
      this.weatherType === "snow" ||
      this.weatherType === "fog"
    ) {
      this.overlayGraphics
        .rect(0, 0, w, h)
        .fill({ color: 0x888888, alpha: 0.08 });
    }
  }

  private rebuildSeasonOverlay(): void {
    this.seasonGraphics.clear();
    const season = getSeason(this.currentMonth);
    const tint = SEASON_TINTS[season];
    if (tint != null) {
      this.seasonGraphics
        .rect(0, 0, this.mapWidth, this.mapHeight)
        .fill({ color: tint, alpha: 0.06 });
    }
  }
}
