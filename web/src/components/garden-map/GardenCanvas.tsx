/**
 * Main PixiJS canvas component for the garden map.
 * Renders tiles, structures, zones, and plant sprites with pan/zoom.
 */

import { useRef, useEffect, useCallback, useState, useImperativeHandle, forwardRef } from "react";
import {
  Application,
  Container,
  Sprite,
  Texture,
  Graphics,
  Text,
  TextStyle,
} from "pixi.js";
import { Viewport } from "pixi-viewport";
import type { Location, Structure, Zone, PlantInstance } from "../../api";
import { generateMap, calculatePlantPositions } from "./map-generator";
import { TILE_SIZE, generateTilePattern, renderTileToCanvas, TileType } from "./tiles";
import { getPlantTexture, preloadPlantTextures, clearTextureCache } from "./sprite-textures";
import { ParticleEmitter, getMoodParticleType, getMoodParticleRate } from "./particles";
import type { PlantMood } from "../../api";

interface GardenCanvasProps {
  location: Location;
  structures: Structure[];
  zones: Zone[];
  plants: PlantInstance[];
  onPlantClick?: (plant: PlantInstance, screenX: number, screenY: number) => void;
  onBackgroundClick?: () => void;
}

export interface GardenCanvasHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  fitView: () => void;
}

// Sprite scale relative to tiles (how big plants appear)
const PLANT_SPRITE_SCALE = 2.5;

// Animation state per plant
interface PlantAnim {
  sprite: Sprite;
  plant: PlantInstance;
  baseX: number;
  baseY: number;
  phase: number; // random phase offset
}

const GardenCanvas = forwardRef<GardenCanvasHandle, GardenCanvasProps>(function GardenCanvas({
  location,
  structures,
  zones,
  plants,
  onPlantClick,
  onBackgroundClick,
}: GardenCanvasProps, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const viewportRef = useRef<Viewport | null>(null);
  const animsRef = useRef<PlantAnim[]>([]);
  const emittersRef = useRef<ParticleEmitter[]>([]);
  const tickerCallbackRef = useRef<((dt: { deltaTime: number }) => void) | null>(null);
  const [ready, setReady] = useState(false);

  // Build the scene
  const buildScene = useCallback(async () => {
    const container = containerRef.current;
    if (!container) return;

    // Clean up previous
    if (appRef.current) {
      if (tickerCallbackRef.current) {
        appRef.current.ticker.remove(tickerCallbackRef.current);
      }
      appRef.current.destroy(true, { children: true, texture: false });
      appRef.current = null;
      viewportRef.current = null;
    }

    const width = container.clientWidth;
    const height = container.clientHeight;

    // Create PixiJS app
    const app = new Application();
    await app.init({
      width,
      height,
      backgroundColor: 0x1a1a1a,
      antialias: false,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    container.appendChild(app.canvas);
    app.canvas.style.imageRendering = "pixelated";
    appRef.current = app;

    // Generate tile map
    const map = generateMap(location, structures, zones);

    // Create viewport for pan/zoom
    const viewport = new Viewport({
      screenWidth: width,
      screenHeight: height,
      worldWidth: map.pixelWidth,
      worldHeight: map.pixelHeight,
      events: app.renderer.events,
    });

    viewport
      .drag()
      .pinch()
      .wheel({ smooth: 3 })
      .decelerate({ friction: 0.92 })
      .clampZoom({ minScale: 0.5, maxScale: 6 })
      .clamp({ direction: "all" });

    app.stage.addChild(viewport);
    viewportRef.current = viewport;

    // Handle background clicks
    viewport.on("clicked", (e) => {
      // Only fire if the click wasn't on a plant sprite
      if (e.event.target === viewport || e.event.target instanceof Graphics) {
        onBackgroundClick?.();
      }
    });

    // ---- LAYER 1: Tiles ----
    const tileContainer = new Container();
    tileContainer.label = "tiles";

    // Create tile textures (cache by type+seed combos)
    const tileTextureCache = new Map<string, Texture>();

    function getTileTexture(type: TileType, seed: number): Texture {
      // Use seed mod 4 for variation (4 variants per type)
      const varSeed = seed % 4;
      const key = `${type}:${varSeed}`;
      if (tileTextureCache.has(key)) return tileTextureCache.get(key)!;

      const pixels = generateTilePattern(type, varSeed);
      const canvas = renderTileToCanvas(pixels);
      const texture = Texture.from({ resource: canvas, antialias: false });
      tileTextureCache.set(key, texture);
      return texture;
    }

    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const cell = map.tiles[y]![x]!;
        if (cell.type === TileType.EMPTY) continue;

        const texture = getTileTexture(cell.type, cell.seed);
        const sprite = new Sprite(texture);
        sprite.x = x * TILE_SIZE;
        sprite.y = y * TILE_SIZE;
        sprite.width = TILE_SIZE;
        sprite.height = TILE_SIZE;
        tileContainer.addChild(sprite);
      }
    }

    viewport.addChild(tileContainer);

    // ---- LAYER 2: Zone borders + labels ----
    const zoneContainer = new Container();
    zoneContainer.label = "zones";

    for (const zone of zones) {
      const zx = (4 + zone.posX) * TILE_SIZE;
      const zy = (4 + zone.posY) * TILE_SIZE;
      const zw = zone.width * TILE_SIZE;
      const zh = zone.depth * TILE_SIZE;

      // Zone border
      const border = new Graphics();
      const zoneColor = zone.color ? parseInt(zone.color.replace("#", ""), 16) : 0x8b7355;
      border.rect(zx, zy, zw, zh);
      border.stroke({ width: 2, color: zoneColor, alpha: 0.6 });
      zoneContainer.addChild(border);

      // Corner markers
      const corners = new Graphics();
      const cornerLen = Math.min(8, Math.min(zw, zh) / 4);
      // Top-left
      corners.moveTo(zx, zy + cornerLen).lineTo(zx, zy).lineTo(zx + cornerLen, zy);
      // Top-right
      corners.moveTo(zx + zw - cornerLen, zy).lineTo(zx + zw, zy).lineTo(zx + zw, zy + cornerLen);
      // Bottom-left
      corners.moveTo(zx, zy + zh - cornerLen).lineTo(zx, zy + zh).lineTo(zx + cornerLen, zy + zh);
      // Bottom-right
      corners.moveTo(zx + zw - cornerLen, zy + zh).lineTo(zx + zw, zy + zh).lineTo(zx + zw, zy + zh - cornerLen);
      corners.stroke({ width: 2, color: zoneColor, alpha: 0.9 });
      zoneContainer.addChild(corners);

      // Zone label
      const labelStyle = new TextStyle({
        fontFamily: "monospace",
        fontSize: 8,
        fill: 0xffffff,
        letterSpacing: 0,
      });
      const label = new Text({ text: zone.name, style: labelStyle });
      label.anchor.set(0.5, 0);
      label.x = zx + zw / 2;
      label.y = zy - 12;
      label.alpha = 0.8;

      // Label background
      const labelBg = new Graphics();
      const labelPad = 3;
      labelBg.roundRect(
        label.x - label.width / 2 - labelPad,
        label.y - labelPad,
        label.width + labelPad * 2,
        label.height + labelPad * 2,
        2,
      );
      labelBg.fill({ color: 0x000000, alpha: 0.6 });
      zoneContainer.addChild(labelBg);
      zoneContainer.addChild(label);
    }

    viewport.addChild(zoneContainer);

    // ---- LAYER 3: Structure labels ----
    const structContainer = new Container();
    structContainer.label = "structures";

    for (const struct of structures) {
      const sx = (4 + struct.posX) * TILE_SIZE;
      const sy = (4 + struct.posY) * TILE_SIZE;
      const sw = struct.width * TILE_SIZE;
      const sh = struct.depth * TILE_SIZE;

      const labelStyle = new TextStyle({
        fontFamily: "monospace",
        fontSize: 7,
        fill: 0xb0a89a,
        letterSpacing: 0,
      });
      const label = new Text({ text: struct.name, style: labelStyle });
      label.anchor.set(0.5, 0.5);
      label.x = sx + sw / 2;
      label.y = sy + sh / 2;
      label.alpha = 0.7;
      structContainer.addChild(label);
    }

    viewport.addChild(structContainer);

    // ---- LAYER 4: Plant sprites ----
    const plantContainer = new Container();
    plantContainer.label = "plants";

    // Group plants by zone
    const plantsByZone = new Map<number, PlantInstance[]>();
    const unzonedPlants: PlantInstance[] = [];
    for (const plant of plants) {
      if (plant.zoneId) {
        const list = plantsByZone.get(plant.zoneId) ?? [];
        list.push(plant);
        plantsByZone.set(plant.zoneId, list);
      } else {
        unzonedPlants.push(plant);
      }
    }

    // Preload textures
    preloadPlantTextures(
      plants.map((p) => ({
        plantType: p.plantReference?.plantType,
        mood: p.mood,
      })),
    );

    const plantAnims: PlantAnim[] = [];
    const particleEmitters: ParticleEmitter[] = [];

    for (const zone of zones) {
      const zonePlants = plantsByZone.get(zone.id) ?? [];
      if (zonePlants.length === 0) continue;

      const positions = calculatePlantPositions(zone, zonePlants.length);

      zonePlants.forEach((plant, i) => {
        const pos = positions[i];
        if (!pos) return;

        const texture = getPlantTexture(
          plant.plantReference?.plantType,
          plant.mood as PlantMood,
        );

        const sprite = new Sprite(texture);
        sprite.anchor.set(0.5, 1); // bottom-center anchor
        sprite.x = pos.x;
        sprite.y = pos.y;
        sprite.width = TILE_SIZE * PLANT_SPRITE_SCALE;
        sprite.height = TILE_SIZE * PLANT_SPRITE_SCALE;

        // Make interactive
        sprite.eventMode = "static";
        sprite.cursor = "pointer";
        sprite.on("pointertap", (e) => {
          e.stopPropagation();
          if (onPlantClick) {
            const global = sprite.getGlobalPosition();
            onPlantClick(plant, global.x, global.y - sprite.height / 2);
          }
        });

        // Hover glow effect
        sprite.on("pointerover", () => {
          sprite.alpha = 0.85;
          sprite.scale.set(
            PLANT_SPRITE_SCALE + 0.3,
            PLANT_SPRITE_SCALE + 0.3,
          );
        });
        sprite.on("pointerout", () => {
          sprite.alpha = plant.mood === "sleeping" ? 0.7 : 1;
          sprite.scale.set(PLANT_SPRITE_SCALE, PLANT_SPRITE_SCALE);
        });

        // Planned plants are ghostly
        if (plant.status === "planned") {
          sprite.alpha = 0.4;
        } else if (plant.mood === "sleeping") {
          sprite.alpha = 0.7;
        }

        plantContainer.addChild(sprite);

        // Register for animation
        plantAnims.push({
          sprite,
          plant,
          baseX: pos.x,
          baseY: pos.y,
          phase: Math.random() * Math.PI * 2,
        });

        // Add particle effects for mood
        const particleType = getMoodParticleType(plant.mood);
        if (particleType && plant.status !== "planned") {
          const emitter = new ParticleEmitter(plantContainer, {
            x: pos.x,
            y: pos.y - TILE_SIZE * PLANT_SPRITE_SCALE * 0.5,
            type: particleType,
            rate: getMoodParticleRate(plant.mood),
          });
          particleEmitters.push(emitter);
        }
      });
    }

    viewport.addChild(plantContainer);
    animsRef.current = plantAnims;
    emittersRef.current = particleEmitters;

    // ---- LAYER 5: Lot boundary indicator ----
    const lotBorder = new Graphics();
    const lotX = 4 * TILE_SIZE;
    const lotY = 4 * TILE_SIZE;
    const lotW = (location.lotWidth ?? 50) * TILE_SIZE;
    const lotH = (location.lotDepth ?? 50) * TILE_SIZE;

    // Dashed lot boundary
    const dashLen = 6;
    const gapLen = 4;
    drawDashedRect(lotBorder, lotX, lotY, lotW, lotH, dashLen, gapLen);
    lotBorder.stroke({ width: 1, color: 0x555555, alpha: 0.5 });
    viewport.addChild(lotBorder);

    // ---- ANIMATION LOOP ----
    let elapsed = 0;

    const tickerCallback = (ticker: { deltaTime: number }) => {
      elapsed += ticker.deltaTime * 0.02;

      for (const anim of animsRef.current) {
        const { sprite, plant, baseX, baseY, phase } = anim;
        const mood = plant.mood as PlantMood;

        switch (mood) {
          case "happy":
          case "new": {
            // Gentle bounce
            sprite.y = baseY + Math.sin(elapsed * 2 + phase) * 1.5;
            break;
          }
          case "thirsty": {
            // Slight droop + slow sway
            sprite.y = baseY + 1;
            sprite.rotation = Math.sin(elapsed * 1.2 + phase) * 0.05;
            break;
          }
          case "hot": {
            // Quick shimmer
            sprite.y = baseY + Math.sin(elapsed * 4 + phase) * 0.5;
            break;
          }
          case "cold": {
            // Shiver (oscillate around base position)
            sprite.x = baseX + Math.sin(elapsed * 8 + phase) * 0.8;
            break;
          }
          case "wilting": {
            // Droop lean
            sprite.rotation = Math.sin(elapsed * 0.5 + phase) * 0.08 + 0.1;
            sprite.y = baseY + 2;
            break;
          }
          case "sleeping": {
            // Static, no animation
            break;
          }
          default: {
            // Default gentle idle
            sprite.y = baseY + Math.sin(elapsed * 1.5 + phase) * 0.8;
          }
        }
      }

      // Update particle emitters
      const dtSeconds = ticker.deltaTime / 60;
      for (const emitter of emittersRef.current) {
        emitter.update(dtSeconds);
      }
    };

    tickerCallbackRef.current = tickerCallback;
    app.ticker.add(tickerCallback);

    // Center viewport on the lot
    viewport.moveCenter(lotX + lotW / 2, lotY + lotH / 2);
    viewport.fit(true, lotW + TILE_SIZE * 8, lotH + TILE_SIZE * 8);

    setReady(true);
  }, [location, structures, zones, plants, onPlantClick, onBackgroundClick]);

  // Init and rebuild on data change
  useEffect(() => {
    buildScene();

    return () => {
      if (tickerCallbackRef.current && appRef.current) {
        appRef.current.ticker.remove(tickerCallbackRef.current);
      }
      for (const emitter of emittersRef.current) {
        emitter.destroy();
      }
      emittersRef.current = [];
      if (appRef.current) {
        appRef.current.destroy(true, { children: true, texture: false });
        appRef.current = null;
      }
      clearTextureCache();
    };
  }, [buildScene]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      const container = containerRef.current;
      const app = appRef.current;
      const viewport = viewportRef.current;
      if (!container || !app || !viewport) return;

      const width = container.clientWidth;
      const height = container.clientHeight;
      app.renderer.resize(width, height);
      viewport.resize(width, height);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [ready]);

  // Expose zoom controls to parent
  useImperativeHandle(ref, () => ({
    zoomIn: () => {
      const vp = viewportRef.current;
      if (vp) vp.animate({ scale: vp.scale.x * 1.5, time: 200 });
    },
    zoomOut: () => {
      const vp = viewportRef.current;
      if (vp) vp.animate({ scale: vp.scale.x / 1.5, time: 200 });
    },
    fitView: () => {
      const vp = viewportRef.current;
      if (vp) {
        vp.fit(true);
        vp.moveCenter(vp.worldWidth / 2, vp.worldHeight / 2);
      }
    },
  }), []);

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ imageRendering: "pixelated" }}
    />
  );
});

export default GardenCanvas;

/** Draw a dashed rectangle using moveTo/lineTo */
function drawDashedRect(
  g: Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  dashLen: number,
  gapLen: number,
): void {
  const edges = [
    { x1: x, y1: y, x2: x + w, y2: y },
    { x1: x + w, y1: y, x2: x + w, y2: y + h },
    { x1: x + w, y1: y + h, x2: x, y2: y + h },
    { x1: x, y1: y + h, x2: x, y2: y },
  ];

  for (const edge of edges) {
    const dx = edge.x2 - edge.x1;
    const dy = edge.y2 - edge.y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    const nx = dx / len;
    const ny = dy / len;
    let pos = 0;
    let drawing = true;

    while (pos < len) {
      const segLen = drawing ? dashLen : gapLen;
      const end = Math.min(pos + segLen, len);

      if (drawing) {
        g.moveTo(edge.x1 + nx * pos, edge.y1 + ny * pos);
        g.lineTo(edge.x1 + nx * end, edge.y1 + ny * end);
      }

      pos = end;
      drawing = !drawing;
    }
  }
}
