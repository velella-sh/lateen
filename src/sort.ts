/* The comparison rules every sortable table shares: a raw cell becomes a key by its field kind, an
 * empty value stays last whichever way the column runs, and equal keys keep the order they came in.
 * The module touches no DOM, so a page island and a test read the same rules. */

/** A sort direction, as `aria-sort` spells it. */
export type SortDirection = "ascending" | "descending";

/** A comparable cell value: a number for number and date columns, text otherwise, absent when empty. */
export type SortKey = number | string | undefined;

/** True when a value carries nothing, as a cell reads it. */
function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  return Array.isArray(value) && value.length === 0;
}

/** The raw value of one cell as its comparison key, or undefined when it is empty or does not parse. */
export function sortKey(value: unknown, kind: string): SortKey {
  if (isEmpty(value)) return undefined;
  if (kind === "number" || kind === "days") {
    const number = typeof value === "number" ? value : Number(value);
    return Number.isFinite(number) ? number : undefined;
  }
  if (kind === "date") {
    const date = typeof value === "number" ? value : Date.parse(String(value));
    return Number.isNaN(date) ? undefined : date;
  }
  return String(value);
}

/** Two values in ascending order. Empty values come last, and text uses the page language's collation. */
export function compareKeys(a: SortKey, b: SortKey, kind: string, lang: string): number {
  if (a === undefined && b === undefined) return 0;
  if (a === undefined) return 1;
  if (b === undefined) return -1;
  if (kind === "number" || kind === "date" || kind === "days") return (a as number) - (b as number);
  return new Intl.Collator(lang, { sensitivity: "variant" }).compare(String(a), String(b));
}

/**
 * The items in their new order. Empty values stay last whichever way the column runs, and equal values
 * keep the order they came in, so two clicks never shuffle rows the reader was reading.
 */
export function sortRows<T>(
  rows: readonly T[],
  keyOf: (row: T) => SortKey,
  kind: string,
  direction: SortDirection,
  lang: string,
): T[] {
  return rows
    .map((row, at) => ({ row, at, key: keyOf(row) }))
    .sort((x, y) => {
      const order = compareKeys(x.key, y.key, kind, lang);
      if (order === 0 || x.key === undefined || y.key === undefined) return order === 0 ? x.at - y.at : order;
      return direction === "descending" ? -order : order;
    })
    .map((entry) => entry.row);
}
