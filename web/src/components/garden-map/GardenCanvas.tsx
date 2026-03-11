/**
 * Main PixiJS canvas component for the garden map.
 * Renders tiles, house sprite, zones, plant sprites, weather effects,
 * and wildlife with pan/zoom.
 */

import { useRef, useEffect, useCallback, useState, useImperativeHandle, forwardRef } from "react";
import {
  Application,
  Container,
  Sprite,
  Texture,
  CanvasSource,
  Graphics,
  Text,
  TextStyle,
} from "pixi.js";
import { Viewport } from "pixi-viewport";
import type { Location, Structure, Zone, PlantInstance, Weather, SunData } from "../../api";
import { generateMap, calculatePlantPositions, type PlantLayout } from "./map-generator";
import {
  TILE_SIZE,
  generateTilePattern,
  renderTileToCanvas,
  TileType,
  WANG_TILESET_MAP,
  preloadWangTilesets,
  getWangTileCanvas,
  computeWangCorners,
  clearWangTilesetCache,
  type LoadedWangTileset,
  loadFenceTexture,
  clearFenceTextureCache,
} from "./tiles";
import { clearTextureCache, createPlantSprite, preloadPlantTextures, tryLoadPlantAnimation } from "./sprite-textures";
import type { PlantAnimator } from "./sprite-animation";
import { ParticleEmitter, getMoodParticleType, getMoodParticleRate } from "./particles";
import { SpeechBubbleManager } from "./speech-bubbles";
import { loadHouseTexture, clearHouseTextureCache } from "./house-sprite";
import { WeatherEffectSystem } from "./weather-effects";
import { WildlifeSystem } from "./wildlife";
import type { PlantMood } from "../../api";

interface GardenCanvasProps {
  location: Location;
  structures: Structure[];
  zones: Zone[];
  plants: PlantInstance[];
  weather?: Weather | null;
  sunData?: SunData | null;
  onPlantClick?: (plant: PlantInstance, screenX: number, screenY: number) => void;
  onBackgroundClick?: () => void;
}

export interface GardenCanvasHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  fitView: () => void;
}

// Sprite scale relative to tiles (32px PNGs × 1.25 = 40px in-world)
const PLANT_SPRITE_SCALE = 1.25;

// Animation state per plant
interface PlantAnim {
  sprite: Sprite;
  plant: PlantInstance;
  baseX: number;
  baseY: number;
  phase: number; // random phase offset
  animator?: PlantAnimator | null; // spritesheet frame cycling
}

// Zone rotation state for zones with more plants than slots
interface ZoneRotation {
  zoneId: number;
  allPlants: PlantInstance[];
  positions: Array<{ x: number; y: number }>;
  maxSlots: number;
  currentOffset: number;
  container: Container;
  timer: number;
}

/** Determine time-of-day phase from sun data */
function getTimeOfDay(sunData: SunData | null | undefined): "night" | "dawn" | "day" | "dusk" {
  if (!sunData) return "day";

  const now = new Date();
  const sunrise = new Date(sunData.sunrise);
  const sunset = new Date(sunData.sunset);

  const dawnStart = new Date(sunrise.getTime() - 30 * 60 * 1000); // 30 min before sunrise
  const duskEnd = new Date(sunset.getTime() + 30 * 60 * 1000); // 30 min after sunset

  if (now < dawnStart) return "night";
  if (now < sunrise) return "dawn";
  if (now < sunset) return "day";
  if (now < duskEnd) return "dusk";
  return "night";
}

const GardenCanvas = forwardRef<GardenCanvasHandle, GardenCanvasProps>(function GardenCanvas({
  location,
  structures,
  zones,
  plants,
  weather,
  sunData,
  onPlantClick,
  onBackgroundClick,
}: GardenCanvasProps, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const viewportRef = useRef<Viewport | null>(null);
  const animsRef = useRef<PlantAnim[]>([]);
  const emittersRef = useRef<ParticleEmitter[]>([]);
  const zoneRotationsRef = useRef<ZoneRotation[]>([]);
  // Track clickable plant regions for manual hit testing (pixi-viewport consumes pointer events)
  const plantHitAreasRef = useRef<Array<{ plant: PlantInstance; x: number; y: number; w: number; h: number }>>([]);
  const weatherSystemRef = useRef<WeatherEffectSystem | null>(null);
  const wildlifeSystemRef = useRef<WildlifeSystem | null>(null);
  const speechBubbleRef = useRef<SpeechBubbleManager | null>(null);
  const tickerCallbackRef = useRef<((dt: { deltaTime: number }) => void) | null>(null);
  const appInitFailedRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [webglFailed, setWebglFailed] = useState(false);

  // Initialize PixiJS app ONCE — separated from scene building to avoid
  // destroying/recreating WebGL contexts on every data change
  useEffect(() => {
    const container = containerRef.current;
    if (!container || appRef.current || appInitFailedRef.current) return;

    let cancelled = false;

    (async () => {
      const width = container.clientWidth;
      const height = container.clientHeight;

      const app = new Application();
      try {
        await app.init({
          width,
          height,
          backgroundColor: 0x1a1a1a,
          antialias: false,
          resolution: window.devicePixelRatio || 1,
          autoDensity: true,
          preference: "webgl",
        });
      } catch (err) {
        console.error("[GardenMap] Failed to init PixiJS:", err);
        appInitFailedRef.current = true;
        if (!cancelled) setWebglFailed(true);
        return;
      }

      if (cancelled) {
        app.destroy(true);
        return;
      }

      container.appendChild(app.canvas);
      app.canvas.style.imageRendering = "pixelated";
      appRef.current = app;

      // Handle WebGL context loss (log only, don't try recursive rebuild)
      const glCanvas = app.canvas as HTMLCanvasElement;
      glCanvas.addEventListener("webglcontextlost", (e) => {
        e.preventDefault();
        console.warn("[GardenMap] WebGL context lost");
      });

      // Trigger scene build
      setReady((v) => !v);
    })();

    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- app init runs once

  // Build the scene contents (reuses existing app)
  const buildScene = useCallback(async () => {
    const container = containerRef.current;
    const app = appRef.current;
    if (!container || !app) return;

    // Don't build until we have actual data
    if (zones.length === 0 && plants.length === 0) {
      console.log("[GardenMap] Skipping build — no data yet");
      return;
    }

    // Clean up previous scene contents (but keep the app/context alive)
    if (tickerCallbackRef.current) {
      app.ticker.remove(tickerCallbackRef.current);
      tickerCallbackRef.current = null;
    }
    weatherSystemRef.current?.destroy();
    weatherSystemRef.current = null;
    wildlifeSystemRef.current?.destroy();
    wildlifeSystemRef.current = null;
    speechBubbleRef.current?.destroy();
    speechBubbleRef.current = null;
    if (viewportRef.current) {
      app.stage.removeChild(viewportRef.current);
      viewportRef.current.destroy({ children: true });
      viewportRef.current = null;
    }
    plantHitAreasRef.current = [];

    const width = container.clientWidth;
    const height = container.clientHeight;

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
      .clampZoom({ minScale: 0.8, maxScale: 8 })
      .clamp({ direction: "all" });

    app.stage.addChild(viewport);
    viewportRef.current = viewport;

    // Handle clicks via viewport's clicked event (pixi-viewport consumes pointer events,
    // so per-sprite pointertap doesn't work). Manual hit test against plant positions.
    viewport.on("clicked", (e) => {
      const worldX = e.world.x;
      const worldY = e.world.y;

      // Check if click hit any plant sprite
      for (const hit of plantHitAreasRef.current) {
        if (worldX >= hit.x && worldX <= hit.x + hit.w &&
            worldY >= hit.y && worldY <= hit.y + hit.h) {
          if (onPlantClick) {
            // Convert world position to screen position for panel placement
            const screenPt = viewport.toScreen(worldX, worldY);
            onPlantClick(hit.plant, screenPt.x, screenPt.y);
          }
          return;
        }
      }

      // No plant hit — background click
      onBackgroundClick?.();
    });

    // ---- LAYER 1: Tiles ----
    const tileContainer = new Container();
    tileContainer.label = "tiles";

    // Preload Wang tilesets and fence textures, then render all tiles
    const [wangTilesets, fenceH, fenceCorner] = await Promise.all([
      preloadWangTilesets(),
      loadFenceTexture("horizontal"),
      loadFenceTexture("corner"),
    ]);

    // Create tile textures (cache by type+seed combos for procedural fallback)
    const tileTextureCache = new Map<string, Texture>();

    function getProceduralTileTexture(type: TileType, seed: number): Texture {
      const varSeed = seed % 4;
      const key = `${type}:${varSeed}`;
      if (tileTextureCache.has(key)) return tileTextureCache.get(key)!;

      const pixels = generateTilePattern(type, varSeed);
      const canvas = renderTileToCanvas(pixels);
      const source = new CanvasSource({
        resource: canvas,
        resolution: 1,
        scaleMode: "nearest",
      });
      const texture = new Texture({ source });
      tileTextureCache.set(key, texture);
      return texture;
    }

    function getWangTileTexture(
      tileset: LoadedWangTileset,
      x: number,
      y: number,
    ): Texture {
      const corners = computeWangCorners(map.tiles, x, y, tileset.name);
      const key = `wang:${tileset.name}:${corners.NW}${corners.NE}${corners.SW}${corners.SE}`;
      if (tileTextureCache.has(key)) return tileTextureCache.get(key)!;

      const canvas = getWangTileCanvas(tileset, corners);
      const source = new CanvasSource({
        resource: canvas,
        resolution: 1,
        scaleMode: "nearest",
      });
      const texture = new Texture({ source });
      tileTextureCache.set(key, texture);
      return texture;
    }

    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const cell = map.tiles[y]![x]!;
        if (cell.type === TileType.EMPTY) continue;

        let texture: Texture;
        if (cell.type === TileType.FENCE_H || cell.type === TileType.FENCE_V) {
          texture = fenceH;
        } else if (cell.type === TileType.FENCE_CORNER) {
          texture = fenceCorner;
        } else {
          // Use Wang tileset if available for this tile type, else procedural
          const wangName = WANG_TILESET_MAP[cell.type];
          const wangTileset = wangName ? wangTilesets.get(wangName) : undefined;
          texture = wangTileset
            ? getWangTileTexture(wangTileset, x, y)
            : getProceduralTileTexture(cell.type, cell.seed);
        }

        const sprite = new Sprite(texture);
        sprite.x = x * TILE_SIZE;
        sprite.y = y * TILE_SIZE;
        sprite.width = TILE_SIZE;
        sprite.height = TILE_SIZE;

        // Rotate vertical fences 90 degrees
        if (cell.type === TileType.FENCE_V) {
          sprite.anchor.set(0.5, 0.5);
          sprite.x = x * TILE_SIZE + TILE_SIZE / 2;
          sprite.y = y * TILE_SIZE + TILE_SIZE / 2;
          sprite.rotation = Math.PI / 2;
        }

        tileContainer.addChild(sprite);
      }
    }

    viewport.addChild(tileContainer);

    // ---- LAYER 2: House sprite ----
    if (map.houseArea && structures.length > 0) {
      const mainStruct = structures[0]!;
      const ha = map.houseArea;
      const houseTexture = await loadHouseTexture(ha.w, ha.h, mainStruct);
      const houseSprite = new Sprite(houseTexture);
      houseSprite.x = ha.x * TILE_SIZE;
      houseSprite.y = ha.y * TILE_SIZE;
      houseSprite.width = ha.w * TILE_SIZE;
      houseSprite.height = ha.h * TILE_SIZE;
      viewport.addChild(houseSprite);
    }

    // ---- LAYER 3: Zone borders + labels ----
    const zoneContainer = new Container();
    zoneContainer.label = "zones";

    for (const zone of zones) {
      const zoneArea = map.zoneAreas.get(zone.id);
      if (!zoneArea) continue;

      const zx = zoneArea.x * TILE_SIZE;
      const zy = zoneArea.y * TILE_SIZE;
      const zw = zoneArea.w * TILE_SIZE;
      const zh = zoneArea.h * TILE_SIZE;

      // Zone border — thick and visible
      const border = new Graphics();
      const zoneColor = zone.color ? parseInt(zone.color.replace("#", ""), 16) : 0x8b7355;
      border.rect(zx, zy, zw, zh);
      border.stroke({ width: 3, color: zoneColor, alpha: 0.85 });
      zoneContainer.addChild(border);

      // Corner markers — prominent
      const corners = new Graphics();
      const cornerLen = Math.min(12, Math.min(zw, zh) / 3);
      // Top-left
      corners.moveTo(zx, zy + cornerLen).lineTo(zx, zy).lineTo(zx + cornerLen, zy);
      // Top-right
      corners.moveTo(zx + zw - cornerLen, zy).lineTo(zx + zw, zy).lineTo(zx + zw, zy + cornerLen);
      // Bottom-left
      corners.moveTo(zx, zy + zh - cornerLen).lineTo(zx, zy + zh).lineTo(zx + cornerLen, zy + zh);
      // Bottom-right
      corners.moveTo(zx + zw - cornerLen, zy + zh).lineTo(zx + zw, zy + zh).lineTo(zx + zw, zy + zh - cornerLen);
      corners.stroke({ width: 3, color: zoneColor, alpha: 1.0 });
      zoneContainer.addChild(corners);

      // Zone label — larger and more visible
      const labelStyle = new TextStyle({
        fontFamily: "monospace",
        fontSize: 10,
        fill: 0xffffff,
        fontWeight: "bold",
        letterSpacing: 0,
      });
      const label = new Text({ text: zone.name, style: labelStyle });
      label.anchor.set(0.5, 0);
      label.x = zx + zw / 2;
      label.y = zy - 14;
      label.alpha = 0.9;

      // Label background
      const labelBg = new Graphics();
      const labelPad = 4;
      labelBg.roundRect(
        label.x - label.width / 2 - labelPad,
        label.y - labelPad,
        label.width + labelPad * 2,
        label.height + labelPad * 2,
        3,
      );
      labelBg.fill({ color: 0x000000, alpha: 0.7 });
      zoneContainer.addChild(labelBg);
      zoneContainer.addChild(label);
    }

    viewport.addChild(zoneContainer);

    // ---- LAYER 4: Structure labels (for non-primary structures) ----
    if (structures.length > 1) {
      const structContainer = new Container();
      structContainer.label = "structures";

      // Skip the first structure (main house, already rendered as sprite)
      for (let i = 1; i < structures.length; i++) {
        const struct = structures[i]!;
        // Try to find this structure in the house area context
        const labelStyle = new TextStyle({
          fontFamily: "monospace",
          fontSize: 7,
          fill: 0xb0a89a,
          letterSpacing: 0,
        });
        const label = new Text({ text: struct.name, style: labelStyle });
        label.anchor.set(0.5, 0.5);
        // Position relative to map center (abstract positioning)
        label.x = map.pixelWidth / 2;
        label.y = map.pixelHeight / 2;
        label.alpha = 0.7;
        structContainer.addChild(label);
      }

      viewport.addChild(structContainer);
    }

    // ---- LAYER 5: Plant sprites ----
    const plantContainer = new Container();
    plantContainer.label = "plants";

    // Group plants by zone
    const plantsByZone = new Map<number, PlantInstance[]>();
    for (const plant of plants) {
      if (plant.zoneId) {
        const list = plantsByZone.get(plant.zoneId) ?? [];
        list.push(plant);
        plantsByZone.set(plant.zoneId, list);
      }
    }

    const plantAnims: PlantAnim[] = [];
    const particleEmitters: ParticleEmitter[] = [];
    const zoneRotations: ZoneRotation[] = [];

    // Preload all plant textures so createPlantSprite hits cache (effectively sync)
    await preloadPlantTextures(
      plants.map((p) => ({ plantType: p.plantReference?.plantType })),
    );

    /** Create and add a single plant sprite at a position */
    async function addPlantAtPosition(
      plant: PlantInstance,
      pos: { x: number; y: number },
      parent: Container,
    ): Promise<Sprite> {
      const plantSprite = await createPlantSprite(
        plant.plantReference?.plantType,
        plant.mood as PlantMood,
        plant.status ?? undefined,
        plant.plantReference?.bloomColor,
        plant.plantReference?.commonName,
      );

      plantSprite.label = "plant-sprite";
      plantSprite.scale.set(PLANT_SPRITE_SCALE, PLANT_SPRITE_SCALE);
      // Center horizontally, anchor at bottom of sprite (32px base)
      plantSprite.x = pos.x - (16 * PLANT_SPRITE_SCALE);
      plantSprite.y = pos.y - (32 * PLANT_SPRITE_SCALE);

      // Register hit area for manual click detection via viewport clicked event
      const spriteW = 32 * PLANT_SPRITE_SCALE;
      const spriteH = 32 * PLANT_SPRITE_SCALE;
      plantHitAreasRef.current.push({
        plant,
        x: plantSprite.x,
        y: plantSprite.y,
        w: spriteW,
        h: spriteH,
      });

      parent.addChild(plantSprite);

      // Try to load spritesheet animation (gracefully falls back to static)
      const animator = await tryLoadPlantAnimation(plant.plantReference?.plantType);
      if (animator) {
        plantSprite.texture = animator.getCurrentFrame();
      }

      plantAnims.push({
        sprite: plantSprite,
        plant,
        baseX: plantSprite.x,
        baseY: plantSprite.y,
        phase: Math.random() * Math.PI * 2,
        animator,
      });

      // Create particle emitter for mood effects
      const particleType = getMoodParticleType(plant.mood as string);
      if (particleType) {
        const rate = getMoodParticleRate(plant.mood as string);
        const emitter = new ParticleEmitter(parent, {
          x: pos.x,
          y: pos.y - 16,
          type: particleType,
          rate: rate * 0.3, // subtle — avoid particle storm
        });
        particleEmitters.push(emitter);
      }

      return plantSprite;
    }

    for (const zone of zones) {
      const zonePlants = plantsByZone.get(zone.id) ?? [];
      if (zonePlants.length === 0) continue;

      const layout = calculatePlantPositions(zone, zonePlants.length, map);
      const { positions, maxSlots, totalPlants } = layout;

      if (totalPlants <= maxSlots) {
        // All plants fit — just place them
        for (let i = 0; i < zonePlants.length; i++) {
          const plant = zonePlants[i]!;
          const pos = positions[i];
          if (!pos) continue;
          await addPlantAtPosition(plant, pos, plantContainer);
        }
      } else {
        // Too many plants for this zone — set up rotation
        const zoneContainer = new Container();
        zoneContainer.label = `zone-${zone.id}-plants`;

        // Show first batch
        const visibleSlice = zonePlants.slice(0, maxSlots);
        for (let i = 0; i < visibleSlice.length; i++) {
          const plant = visibleSlice[i]!;
          const pos = positions[i];
          if (!pos) continue;
          await addPlantAtPosition(plant, pos, zoneContainer);
        }

        plantContainer.addChild(zoneContainer);

        zoneRotations.push({
          zoneId: zone.id,
          allPlants: zonePlants,
          positions,
          maxSlots,
          currentOffset: 0,
          container: zoneContainer,
          timer: 0,
        });
      }
    }

    viewport.addChild(plantContainer);
    animsRef.current = plantAnims;
    emittersRef.current = particleEmitters;
    zoneRotationsRef.current = zoneRotations;

    // ---- LAYER 5b: Speech bubbles (above plants) ----
    const speechBubbleManager = new SpeechBubbleManager(viewport);
    speechBubbleManager.setPlants(
      plantAnims.map((a) => ({
        sprite: a.sprite,
        plant: {
          id: a.plant.id,
          nickname: a.plant.nickname,
          mood: a.plant.mood,
          status: a.plant.status,
        },
        baseX: a.baseX,
        baseY: a.baseY,
      })),
    );
    speechBubbleRef.current = speechBubbleManager;

    // ---- LAYER 6: Weather effects ----
    const weatherSystem = new WeatherEffectSystem(viewport, map.pixelWidth, map.pixelHeight);
    weatherSystemRef.current = weatherSystem;

    if (weather) {
      weatherSystem.setWeather(weather.conditions ?? null, weather.temperature ?? null);
    }

    weatherSystem.setSeason(new Date().getMonth() + 1);

    const phase = getTimeOfDay(sunData);
    weatherSystem.setTimeOfDay(phase);

    // ---- LAYER 7: Wildlife ----
    const wildlifeSystem = new WildlifeSystem(viewport, map.pixelWidth, map.pixelHeight);
    wildlifeSystemRef.current = wildlifeSystem;

    const month = new Date().getMonth() + 1;
    const season: "spring" | "summer" | "fall" | "winter" =
      month >= 3 && month <= 5 ? "spring" :
      month >= 6 && month <= 8 ? "summer" :
      month >= 9 && month <= 11 ? "fall" :
      "winter";

    wildlifeSystem.configure({
      season,
      timeOfDay: phase,
      isRaining: (weather?.conditions ?? "").toLowerCase().includes("rain"),
    });

    // ---- ANIMATION LOOP ----
    let elapsed = 0;

    const tickerCallback = (ticker: { deltaTime: number }) => {
      const dt = ticker.deltaTime / 60;
      elapsed += ticker.deltaTime * 0.02;

      for (const anim of animsRef.current) {
        const { sprite, plant, baseX, baseY, phase: animPhase } = anim;
        const mood = plant.mood as PlantMood;

        // Advance spritesheet animation if available
        if (anim.animator) {
          sprite.texture = anim.animator.update(dt);
        }

        switch (mood) {
          case "happy":
          case "new": {
            // Gentle bounce
            sprite.y = baseY + Math.sin(elapsed * 2 + animPhase) * 1.5;
            break;
          }
          case "thirsty": {
            // Slight droop + slow sway
            sprite.y = baseY + 1;
            sprite.rotation = Math.sin(elapsed * 1.2 + animPhase) * 0.05;
            break;
          }
          case "hot": {
            // Quick shimmer
            sprite.y = baseY + Math.sin(elapsed * 4 + animPhase) * 0.5;
            break;
          }
          case "cold": {
            // Shiver (oscillate around base position)
            sprite.x = baseX + Math.sin(elapsed * 8 + animPhase) * 0.8;
            break;
          }
          case "wilting": {
            // Droop lean
            sprite.rotation = Math.sin(elapsed * 0.5 + animPhase) * 0.08 + 0.1;
            sprite.y = baseY + 2;
            break;
          }
          case "sleeping": {
            // Static, no animation
            break;
          }
          default: {
            // Default gentle idle
            sprite.y = baseY + Math.sin(elapsed * 1.5 + animPhase) * 0.8;
          }
        }
      }

      // Update particle emitters
      for (const emitter of emittersRef.current) {
        emitter.update(dt);
      }

      // Zone plant rotation (for zones with more plants than slots)
      const ROTATION_INTERVAL = 8; // seconds between rotations
      for (const rot of zoneRotationsRef.current) {
        rot.timer += dt;
        if (rot.timer >= ROTATION_INTERVAL) {
          rot.timer = 0;
          rot.currentOffset = (rot.currentOffset + rot.maxSlots) % rot.allPlants.length;

          // Clear old plants from this zone's container
          rot.container.removeChildren();

          // Remove old hit areas and anims for this zone
          plantHitAreasRef.current = plantHitAreasRef.current.filter(
            (h) => h.plant.zoneId !== rot.zoneId,
          );
          animsRef.current = animsRef.current.filter(
            (a) => a.plant.zoneId !== rot.zoneId,
          );

          // Destroy old particle emitters (they're children of rot.container, already removed)
          // Recreate fresh emitters for the new batch below
          // Note: emitters are children of rot.container so removeChildren() already handled DOM cleanup
          // We just need to remove them from the ref array — filter by checking if destroyed
          emittersRef.current = emittersRef.current.filter(
            (e) => !e.destroyed,
          );

          // Add new batch (async — textures are preloaded so this resolves quickly)
          const start = rot.currentOffset;
          const rotatePromises: Promise<void>[] = [];
          for (let i = 0; i < rot.maxSlots && i < rot.allPlants.length; i++) {
            const plantIdx = (start + i) % rot.allPlants.length;
            const plant = rot.allPlants[plantIdx]!;
            const pos = rot.positions[i];
            if (!pos) continue;

            rotatePromises.push(
              createPlantSprite(
                plant.plantReference?.plantType,
                plant.mood as PlantMood,
                plant.status ?? undefined,
              ).then((plantSprite) => {
                plantSprite.label = "plant-sprite";
                plantSprite.scale.set(PLANT_SPRITE_SCALE, PLANT_SPRITE_SCALE);
                plantSprite.x = pos.x - (16 * PLANT_SPRITE_SCALE);
                plantSprite.y = pos.y - (32 * PLANT_SPRITE_SCALE);

                // Register for manual hit testing
                const sw = 32 * PLANT_SPRITE_SCALE;
                const sh = 32 * PLANT_SPRITE_SCALE;
                plantHitAreasRef.current.push({
                  plant,
                  x: plantSprite.x,
                  y: plantSprite.y,
                  w: sw,
                  h: sh,
                });

                // Fade in — preserve the target alpha set by createPlantSprite
                const targetAlpha = plantSprite.alpha;
                plantSprite.alpha = 0;
                const fadeIn = () => {
                  if (plantSprite.alpha < targetAlpha) {
                    plantSprite.alpha = Math.min(plantSprite.alpha + 0.05, targetAlpha);
                    requestAnimationFrame(fadeIn);
                  }
                };
                requestAnimationFrame(fadeIn);

                rot.container.addChild(plantSprite);

                animsRef.current.push({
                  sprite: plantSprite,
                  plant,
                  baseX: plantSprite.x,
                  baseY: plantSprite.y,
                  phase: Math.random() * Math.PI * 2,
                });

                // Create particle emitter for rotated plant
                const pType = getMoodParticleType(plant.mood as string);
                if (pType) {
                  const pRate = getMoodParticleRate(plant.mood as string);
                  const emitter = new ParticleEmitter(rot.container, {
                    x: pos.x,
                    y: pos.y - 16,
                    type: pType,
                    rate: pRate * 0.3,
                  });
                  emittersRef.current.push(emitter);
                }
              }),
            );
          }
          // Fire and forget — textures are cached so this resolves near-instantly
          Promise.all(rotatePromises).then(() => {
            // Update speech bubble plant list after rotation
            speechBubbleManager.setPlants(
              animsRef.current.map((a) => ({
                sprite: a.sprite,
                plant: {
                  id: a.plant.id,
                  nickname: a.plant.nickname,
                  mood: a.plant.mood,
                  status: a.plant.status,
                },
                baseX: a.baseX,
                baseY: a.baseY,
              })),
            );
          });
        }
      }

      // Speech bubbles
      speechBubbleManager.update(dt);

      // Weather effects
      weatherSystem.update(dt);

      // Wildlife
      wildlifeSystem.update(dt);
    };

    tickerCallbackRef.current = tickerCallback;
    app.ticker.add(tickerCallback);

    // Center viewport on house area with a comfortable zoom
    const centerX = map.houseArea
      ? (map.houseArea.x + map.houseArea.w / 2) * TILE_SIZE
      : map.pixelWidth / 2;
    const centerY = map.houseArea
      ? (map.houseArea.y + map.houseArea.h / 2) * TILE_SIZE
      : map.pixelHeight / 2;
    viewport.setZoom(2.5, true);
    viewport.moveCenter(centerX, centerY);

    setReady(true);
  }, [location, structures, zones, plants, weather, sunData, onPlantClick, onBackgroundClick]);

  // Rebuild scene when data changes or app becomes ready
  useEffect(() => {
    buildScene();

    return () => {
      // Clean up scene contents on data change (NOT the app itself)
      const app = appRef.current;
      if (app) {
        if (tickerCallbackRef.current) {
          app.ticker.remove(tickerCallbackRef.current);
          tickerCallbackRef.current = null;
        }
        for (const emitter of emittersRef.current) {
          emitter.destroy();
        }
        emittersRef.current = [];
        weatherSystemRef.current?.destroy();
        weatherSystemRef.current = null;
        wildlifeSystemRef.current?.destroy();
        wildlifeSystemRef.current = null;
        speechBubbleRef.current?.destroy();
        speechBubbleRef.current = null;
        if (viewportRef.current) {
          app.stage.removeChild(viewportRef.current);
          viewportRef.current.destroy({ children: true });
          viewportRef.current = null;
        }
      }
      clearTextureCache();
      clearHouseTextureCache();
      clearWangTilesetCache();
      clearFenceTextureCache();
    };
  }, [buildScene, ready]);

  // Destroy the app on unmount only
  useEffect(() => {
    return () => {
      if (appRef.current) {
        appRef.current.destroy(true, { children: true, texture: false });
        appRef.current = null;
      }
    };
  }, []);

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

  if (webglFailed) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-stone-950 text-stone-400">
        <div className="text-center max-w-md px-6">
          <p className="text-lg font-bold text-stone-300 mb-2">WebGL Unavailable</p>
          <p className="text-sm mb-4">
            Your browser couldn't create a WebGL context. The garden map requires
            WebGL to render.
          </p>
          <p className="text-xs text-stone-500">
            Try closing other tabs, enabling hardware acceleration in browser
            settings, or using a different browser.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ imageRendering: "pixelated" }}
    />
  );
});

export default GardenCanvas;
