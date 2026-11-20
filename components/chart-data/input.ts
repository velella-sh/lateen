/**
 * The one input-validation path the chart components share: finite values, missing values, labels,
 * ids, and series counts. Bar, stacked-bar, line, and performance charts read their rows through
 * these helpers, so zero, negative, decimal, empty, and malformed inputs behave the same everywhere.
 * This module stays dependency-free (no `preact`), because the island build bundles it into the
 * browser alongside the build-time components.
 */

/** A row of source data: a plain object, never an array or null. */
export type Json = Readonly<Record<string, unknown>>;

/** Whether a value is a plain object a field can be read from. */
export function isJson(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A string trimmed of its outer whitespace; anything that is not a string is empty. */
export function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** A number from a number or a numeric string; anything else, including an empty cell, has no value. */
export function numericValue(raw: unknown): number | undefined {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : undefined;
  if (typeof raw === "string" && raw.trim() !== "") {
    const parsed = Number(raw.trim());
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

/** The value at a dotted or slashed path inside `_data`, or undefined when it does not resolve. */
export function lookup(data: Json, path: string): unknown {
  let node: unknown = data;
  for (const key of path.split(/[./]/).filter((part) => part !== "")) {
    if (!isJson(node) || !Object.hasOwn(node, key)) return undefined;
    node = node[key];
  }
  return node;
}

/** The value at a dotted field path inside a row, or undefined when the path does not resolve. */
export function fieldOf(row: Json, path: string): unknown {
  let node: unknown = row;
  for (const key of path.split(".").filter((part) => part !== "")) {
    if (!isJson(node) || !Object.hasOwn(node, key)) return undefined;
    node = node[key];
  }
  return node;
}

/** A row's label: a string or number as text, and the row's id when the label is absent or empty. */
export function labelOf(raw: unknown, fallback: string): string {
  const label = typeof raw === "string" || typeof raw === "number" ? String(raw) : fallback;
  return label === "" ? fallback : label;
}

/** A label cut to `max` characters, with an ellipsis; the table under the chart keeps the whole label. */
export function shortenLabel(label: string, max: number): string {
  const characters = Array.from(label);
  return characters.length <= max ? label : `${characters.slice(0, max - 1).join("")}…`;
}

/**
 * `dir="ltr"` for a Latin label on a right-to-left page: it states its own direction, so the words
 * keep their order inside the page's right-to-left text. A label in an Arabic or Hebrew script, or one
 * with no letters, keeps the page's direction.
 */
export function labelDir(label: string, rtl: boolean): "ltr" | undefined {
  return rtl && /\p{Script=Latin}/u.test(label) && !/[\p{Script=Arabic}\p{Script=Hebrew}]/u.test(label)
    ? "ltr"
    : undefined;
}

/** A value reduced to letters, digits, `-` and `_`, so it can go in an id. */
export function slugOf(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_-]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * The id prefix of a chart: the slug of the `id` prop, or the chart's prefix and its source path.
 * A prop or source that slugs to nothing falls back to the next name, so a malformed id never
 * produces an empty or duplicate-looking id.
 */
export function idBaseOf(raw: unknown, from: string, prefix: string): string {
  const given = slugOf(text(raw));
  if (given !== "") return given;
  const source = slugOf(from);
  return source === "" ? prefix : `${prefix}-${source}`;
}

/** The number of series a chart colours: one per categorical token, `chart-cat-1` to `chart-cat-8`. */
export const MAX_SERIES = 8;

/** The categorical colour number of a series, cycling through the tokens when there are more. */
export function seriesColour(index: number): number {
  return (index % MAX_SERIES) + 1;
}

/** One validated chart row: a non-empty label and a finite value. */
export interface LabelledRow {
  readonly label: string;
  readonly value: number;
}

/**
 * The rows a chart island reads from its JSON payload: only plain objects with a non-empty string
 * label and a finite value (a number or a numeric string) survive; anything else is left out.
 */
export function chartRows(raw: unknown): LabelledRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    if (!isJson(entry)) return [];
    const label = text(entry.label);
    const value = numericValue(entry.value);
    return label === "" || value === undefined ? [] : [{ label, value }];
  });
}