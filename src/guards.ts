/**
 * Narrow guards for the unknown values front matter, `site.data`, and island payloads hand the theme.
 * Every reader of untrusted data narrows with these before touching a field, so a missing or
 * mis-shaped value is rejected once, here, instead of differently in each unit.
 */

/** A plain JSON object: not `null`, not an array. Narrow unknown data with this before reading fields. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
