/**
 * The one chart-row model the charts server renderer and its browser island share. Both read the
 * same `parseRows` result, so the fallback table, the bar fallback, and the canvas never disagree
 * about a label or a value. This module stays dependency-free (no `preact`), because the island
 * build bundles it into the browser alongside the build-time component.
 */

import { chartRows, type LabelledRow } from "../chart-data/input.ts";

/** One row of the charts component: a non-empty label and a finite value. */
export type ChartRow = LabelledRow;

/**
 * The rows of a charts component, from the `rows` prop or from the JSON payload the server embeds.
 * Only plain objects with a non-empty label and a finite value survive; anything else is left out.
 */
export function parseRows(raw: unknown): ChartRow[] {
  let value: unknown = raw;
  if (typeof raw === "string") {
    if (raw.trim() === "") return [];
    try {
      value = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  return chartRows(value);
}
