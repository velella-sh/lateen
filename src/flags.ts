/*
 * A directive attribute, read once. The engine hands `::version-badge{version=0.3 block}`'s
 * attributes over as strings — `""` for the bare word, the written value for `block=true`, and
 * nothing at all when the author left it out — so every component that shows or hides something on
 * one word has to answer the same question. It is answered here, so one spelling cannot mean two
 * things in two units.
 *
 * This is its own unit rather than a member of `src/guards.ts` because that file is a shared island
 * chunk: every page with an island downloads it, and an export nothing on the client calls would
 * still cost each of those pages bytes (the performance gate measures it at 79 B gzipped).
 */

/** The words that turn a bare directive attribute off. */
const FALSE_WORDS: readonly string[] = ["false", "no", "0", "off"];

/**
 * Whether a directive's bare attribute is on. Absent, `null`, and `false` are off; a string is off
 * only for the false words above, matched without case or surrounding spaces, so `""` and `true`
 * stay on; any other value is on. `version-badge`'s `block`, `reading-time`'s `showWords`, and
 * `preset-preview`'s `picker` all read their flag here.
 */
export function flagOf(value: unknown): boolean {
  if (value === undefined || value === null || value === false) return false;
  if (typeof value !== "string") return true;
  return !FALSE_WORDS.includes(value.trim().toLowerCase());
}
