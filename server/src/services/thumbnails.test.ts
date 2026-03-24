import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { generateThumbnail } from "./thumbnails.js";
import { existsSync, mkdirSync, rmSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEST_DIR = resolve(__dirname, "../../test-photos");

describe("generateThumbnail", () => {
  beforeAll(() => {
    if (!existsSync(TEST_DIR)) mkdirSync(TEST_DIR, { recursive: true });
  });

  afterAll(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
  });

  it("creates a thumbnail file with _thumb suffix", async () => {
    const testImage = await sharp({
      create: {
        width: 800,
        height: 600,
        channels: 3,
        background: { r: 255, g: 0, b: 0 },
      },
    })
      .jpeg()
      .toBuffer();

    const { writeFileSync } = await import("fs");
    writeFileSync(resolve(TEST_DIR, "test-image.jpg"), testImage);

    const thumbFilename = await generateThumbnail(
      TEST_DIR,
      "test-image.jpg",
      400,
    );

    expect(thumbFilename).toBe("test-image_thumb.jpg");
    expect(existsSync(resolve(TEST_DIR, thumbFilename))).toBe(true);

    const meta = await sharp(resolve(TEST_DIR, thumbFilename)).metadata();
    expect(meta.width).toBeLessThanOrEqual(400);
  });
});
