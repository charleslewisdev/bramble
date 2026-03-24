import sharp from "sharp";
import { resolve } from "path";

/**
 * Generate a thumbnail for an image file.
 * Returns the thumbnail filename (original name with _thumb suffix).
 */
export async function generateThumbnail(
  photosDir: string,
  filename: string,
  maxWidth: number = 400,
): Promise<string> {
  const ext = filename.substring(filename.lastIndexOf("."));
  const base = filename.substring(0, filename.lastIndexOf("."));
  const thumbFilename = `${base}_thumb${ext}`;

  await sharp(resolve(photosDir, filename))
    .resize(maxWidth, undefined, { fit: "inside", withoutEnlargement: true })
    .toFile(resolve(photosDir, thumbFilename));

  return thumbFilename;
}
