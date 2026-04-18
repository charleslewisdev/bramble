/**
 * Convert a title into a URL-safe slug.
 * Lowercase, strip non-alphanumerics (except hyphens), collapse whitespace into hyphens,
 * trim leading/trailing hyphens. Returns "untitled" if the result is empty.
 */
export function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip combining diacritics
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return base || "untitled";
}

/**
 * Given a desired slug and a predicate that tests whether a candidate already exists,
 * return the first free variant (appending "-2", "-3", ... on collision).
 */
export function uniqueSlug(
  desired: string,
  exists: (candidate: string) => boolean,
): string {
  if (!exists(desired)) return desired;
  let i = 2;
  while (exists(`${desired}-${i}`)) i++;
  return `${desired}-${i}`;
}
