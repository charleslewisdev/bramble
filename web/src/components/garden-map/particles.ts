/**
 * Simple particle system for mood effects on plant sprites.
 * Sparkles, water droplets, heat waves, etc.
 */

import { Container, Graphics } from "pixi.js";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: number;
  alpha: number;
}

export class ParticleEmitter {
  private particles: Particle[] = [];
  private container: Container;
  private graphics: Graphics;
  private elapsed = 0;
  private emitTimer = 0;
  public destroyed = false;

  constructor(
    parent: Container,
    private config: {
      x: number;
      y: number;
      type: "sparkle" | "droplet" | "heat" | "shiver" | "zzz" | "green_sparkle";
      rate: number; // particles per second
    },
  ) {
    this.container = new Container();
    this.graphics = new Graphics();
    this.container.addChild(this.graphics);
    parent.addChild(this.container);
  }

  update(dt: number): void {
    this.elapsed += dt;
    this.emitTimer += dt;

    // Emit new particles
    const interval = 1 / this.config.rate;
    while (this.emitTimer >= interval) {
      this.emitTimer -= interval;
      this.emit();
    }

    // Update existing particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]!;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      p.alpha = Math.max(0, p.life / p.maxLife);

      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // Redraw
    this.graphics.clear();
    for (const p of this.particles) {
      this.graphics.circle(p.x, p.y, p.size);
      this.graphics.fill({ color: p.color, alpha: p.alpha });
    }
  }

  private emit(): void {
    const { x, y, type } = this.config;

    switch (type) {
      case "sparkle": {
        this.particles.push({
          x: x + (Math.random() - 0.5) * 20,
          y: y - Math.random() * 30,
          vx: (Math.random() - 0.5) * 8,
          vy: -Math.random() * 15 - 5,
          life: 0.8 + Math.random() * 0.5,
          maxLife: 1.3,
          size: 1 + Math.random(),
          color: Math.random() > 0.5 ? 0xfacc15 : 0xfde68a,
          alpha: 1,
        });
        break;
      }
      case "green_sparkle": {
        this.particles.push({
          x: x + (Math.random() - 0.5) * 20,
          y: y - Math.random() * 25,
          vx: (Math.random() - 0.5) * 6,
          vy: -Math.random() * 12 - 3,
          life: 0.7 + Math.random() * 0.4,
          maxLife: 1.1,
          size: 1 + Math.random(),
          color: Math.random() > 0.5 ? 0x34d399 : 0x6ee7b7,
          alpha: 1,
        });
        break;
      }
      case "droplet": {
        this.particles.push({
          x: x + (Math.random() - 0.5) * 12,
          y: y - 20 - Math.random() * 10,
          vx: (Math.random() - 0.5) * 2,
          vy: Math.random() * 20 + 10,
          life: 0.6 + Math.random() * 0.3,
          maxLife: 0.9,
          size: 1 + Math.random() * 0.5,
          color: Math.random() > 0.5 ? 0x60a5fa : 0x93c5fd,
          alpha: 1,
        });
        break;
      }
      case "heat": {
        this.particles.push({
          x: x + (Math.random() - 0.5) * 16,
          y: y - 5,
          vx: (Math.random() - 0.5) * 3,
          vy: -Math.random() * 20 - 8,
          life: 0.5 + Math.random() * 0.3,
          maxLife: 0.8,
          size: 1 + Math.random(),
          color: Math.random() > 0.5 ? 0xf97316 : 0xfb923c,
          alpha: 0.7,
        });
        break;
      }
      case "shiver": {
        // Small ice crystals
        this.particles.push({
          x: x + (Math.random() - 0.5) * 20,
          y: y - Math.random() * 20,
          vx: (Math.random() - 0.5) * 10,
          vy: (Math.random() - 0.5) * 5,
          life: 0.3 + Math.random() * 0.2,
          maxLife: 0.5,
          size: 0.5 + Math.random(),
          color: 0x7dd3fc,
          alpha: 0.8,
        });
        break;
      }
      case "zzz": {
        this.particles.push({
          x: x + 10,
          y: y - 20,
          vx: 3,
          vy: -8,
          life: 1.5,
          maxLife: 1.5,
          size: 2,
          color: 0xa8a29e,
          alpha: 0.6,
        });
        break;
      }
    }
  }

  destroy(): void {
    this.destroyed = true;
    this.container.destroy({ children: true });
  }
}

/** Map plant mood to particle effect type */
export function getMoodParticleType(
  mood: string,
): "sparkle" | "droplet" | "heat" | "shiver" | "zzz" | "green_sparkle" | null {
  switch (mood) {
    case "happy": return "sparkle";
    case "new": return "green_sparkle";
    case "thirsty": return "droplet";
    case "hot": return "heat";
    case "cold": return "shiver";
    case "sleeping": return "zzz";
    default: return null;
  }
}

/** Get particle emission rate for a mood (lower = fewer particles) */
export function getMoodParticleRate(mood: string): number {
  switch (mood) {
    case "happy": return 2;
    case "new": return 2.5;
    case "thirsty": return 1.5;
    case "hot": return 3;
    case "cold": return 4;
    case "sleeping": return 0.3;
    default: return 0;
  }
}
