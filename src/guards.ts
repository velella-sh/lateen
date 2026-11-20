/**
 * Narrow guards for the unknown values front matter, `site.data`, and island payloads hand the theme.
 * Every reader of untrusted data narrows with these before touching a field, so a missing or
 * mis-shaped value is rejected once, here, instead of differently in each unit.
 */

/** A plain JSON object: not `null`, not an array. Narrow unknown data with this before reading fields. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * A non-empty trimmed string: absent, non-string, and blank values are `undefined`. Only the ends are
 * trimmed, so inner whitespace, bidi marks, and the text's own direction survive as written.
 */
export function textOf(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  return text === "" ? undefined : text;
}

/**
 * The value from a fixed vocabulary of state names, matched without case or surrounding spaces, or
 * `undefined` when it is missing, not a string, or names none. A caller that reads another spelling
 * (a legacy alias, or `_` and spaces for `-`) normalizes it first and passes the result, so every
 * accepted spelling is still one the caller names: an unknown value never gets a state of its own.
 */
export function knownOf<const T extends readonly string[]>(vocabulary: T, value: unknown): T[number] | undefined {
  if (typeof value !== "string") return undefined;
  const name = value.trim().toLowerCase();
  return (vocabulary as readonly string[]).includes(name) ? (name as T[number]) : undefined;
}

/**
 * {@link knownOf}, or the documented fallback when the value is missing or unknown. The fallback is
 * one of the vocabulary's own names, so an unknown value reads as a neutral known state rather than
 * as a colour or a class the stylesheet never defined.
 */
export function knownOr<const T extends readonly string[]>(
  vocabulary: T,
  value: unknown,
  fallback: T[number],
): T[number] {
  return knownOf(vocabulary, value) ?? fallback;
}

/**
 * The JSON `text` as unknown data, or `undefined` when it does not parse. A parse failure is the only
 * thing `undefined` can mean here (JSON has no undefined value), and nothing about the shape is
 * trusted at this boundary: callers narrow the value with their own contract afterwards.
 */
export function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}
