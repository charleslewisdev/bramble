# Map Enclosures Design

## Summary

Unified "peek" interaction for enclosed zones and the house on the garden map. Combines issues #28 (indoor house view, property fences) and #29 (greenhouse/covered zone tiles).

## Decisions

- **Peek interaction**: Click any enclosure to open it (300ms alpha fade). Click outside to close. One open at a time.
- **House (indoor)**: Roof fades out, warm floor texture appears, indoor plants render inside house footprint.
- **Greenhouse**: Glass panel overlay fades to wireframe outlines, plants become fully visible.
- **Covered**: Roof/pergola overlay fades to ~20% opacity, plants already partially visible underneath.
- **Property fences**: Fence tiles rendered automatically around the map perimeter for all locations.
- **Assets**: All overlays are procedural (Graphics API), no PixelLab generation needed. Floor texture is a new procedural tile type.
- **Scope**: Core enclosure rendering + peek interaction + property fences. No seasonal variants, no per-zone fences.

## Architecture

### New state in GardenCanvas

```typescript
// Which enclosure is currently "peeked" open
// null = all closed, 'house' = house interior, number = zone ID
type OpenEnclosure = null | 'house' | number;
```

### Rendering changes

**Layer 2 (House)**: House sprite gets a ref. When peeked:
- House sprite alpha fades to 0.15
- Floor texture container (warm wood tiles filling house footprint) fades in
- Indoor plants render inside house bounds using same grid layout as zones

**Layer 3.5 (Enclosure overlays)**: New container between zones and plants:
- Greenhouse zones: Semi-transparent green-tinted glass fill + frame lines
- Covered zones: Pergola beam pattern overlay (similar to existing PERGOLA_BEAM tile but as a Graphics overlay)

**Layer 5 (Plants)**: Indoor zone plants conditionally added to plant container when house is peeked open.

### Click handling (viewport `clicked`)

Priority order:
1. Check plant hit areas (existing)
2. Check house bounds → toggle house peek
3. Check enclosed zone bounds → toggle zone peek
4. Background → close any open peek + call onBackgroundClick

### Fade transitions

Simple requestAnimationFrame loop (~300ms):
- Track target alpha for each enclosure element
- Lerp current alpha toward target each frame
- Clean and reusable pattern for house sprite, overlay graphics, floor container, indoor plants

### Property boundary fences

In `map-generator.ts`, after all zone/path painting:
- Paint FENCE_H tiles along top and bottom edges (just inside padding)
- Paint FENCE_V tiles along left and right edges
- Paint FENCE_CORNER at the four corners
- Skip tiles that already have sidewalk or zone content

## Not in scope (follow-up issues)

- Seasonal greenhouse variants (condensation, open vents)
- Per-zone decorative fences (beds, raised beds)
- PixelLab-generated interior house sprites
- Greenhouse/covered structure PNG sprites
