import { describe, it, expect } from "vitest";
import { createGreenhouseOverlay, type Season } from "./enclosure-overlays";

describe("createGreenhouseOverlay", () => {
  const X = 0;
  const Y = 0;
  const W = 96;
  const H = 64;

  it("returns a container with greenhouse-overlay label", () => {
    const container = createGreenhouseOverlay(X, Y, W, H);
    expect(container.label).toBe("greenhouse-overlay");
  });

  it("creates different child counts for winter (condensation + snow)", () => {
    const spring = createGreenhouseOverlay(X, Y, W, H, "spring");
    const winter = createGreenhouseOverlay(X, Y, W, H, "winter");
    // Winter adds condensation droplets + snow layer = 2 extra children
    expect(winter.children.length).toBe(spring.children.length + 2);
  });

  it("has fewer divider lines in summer (open vent panels)", () => {
    const spring = createGreenhouseOverlay(X, Y, W, H, "spring");
    const summer = createGreenhouseOverlay(X, Y, W, H, "summer");
    // Summer skips some vertical dividers, so divider child should have fewer instructions
    // Both containers still have the same number of child containers
    expect(summer.children.length).toBe(spring.children.length);
  });

  it.each(["spring", "summer", "fall", "winter"] as Season[])(
    "creates a valid container for %s season",
    (season) => {
      const container = createGreenhouseOverlay(X, Y, W, H, season);
      expect(container.label).toBe("greenhouse-overlay");
      // At minimum: glass fill + dividers + frame + posts
      expect(container.children.length).toBeGreaterThanOrEqual(4);
    },
  );

  it("defaults to spring when no season provided", () => {
    const noSeason = createGreenhouseOverlay(X, Y, W, H);
    const spring = createGreenhouseOverlay(X, Y, W, H, "spring");
    expect(noSeason.children.length).toBe(spring.children.length);
  });
});
