/**
 * Fence metadata and the notes it carries. The engine writes one JSON value to `data-code` on every fence
 * with meta, already escaped for an HTML attribute, so the theme reads it there instead of parsing Markdown.
 */

import type { LineRange } from "./lines.ts";
import { decodeEntities } from "./escape.ts";

/** One note on an inclusive run of 1-based lines. */
export type CodeAnnotation = {
  readonly from: number;
  readonly to: number;
  readonly text: string;
};

/** The fields of the engine's `CodeMeta` this theme renders. */
export type FenceMeta = {
  readonly title: string | null;
  readonly highlight: readonly LineRange[];
  readonly ins: readonly LineRange[];
  readonly del: readonly LineRange[];
  readonly diff: boolean;
  readonly showLineNumbers: boolean;
  readonly annotations: readonly CodeAnnotation[];
};

function recordOf(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

/** The usable ranges in a JSON value: whole numbers, 1-based, and never descending. */
function rangesOf(value: unknown): LineRange[] {
  if (!Array.isArray(value)) return [];
  const ranges: LineRange[] = [];
  for (const item of value) {
    const range = recordOf(item);
    const from = range?.from;
    const to = range?.to;
    if (typeof from !== "number" || typeof to !== "number") continue;
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from) continue;
    ranges.push({ from, to });
  }
  return ranges;
}

/** The usable notes in a JSON value: a whole 1-based range and non-blank text. */
function annotationsOf(value: unknown): CodeAnnotation[] {
  if (!Array.isArray(value)) return [];
  const annotations: CodeAnnotation[] = [];
  for (const item of value) {
    const note = recordOf(item);
    const from = note?.from;
    const to = note?.to;
    const text = note?.text;
    if (typeof from !== "number" || typeof to !== "number" || typeof text !== "string") continue;
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from || text.trim() === "") continue;
    annotations.push({ from, to, text });
  }
  return annotations;
}

/**
 * The fence metadata from a `data-code` attribute value, or `undefined` when it is absent or not the
 * object the engine writes. The value is entity-decoded first, because rehype escapes the JSON's quotes
 * and ampersands inside the attribute. Bad fields are dropped, never trusted: annotation text is later
 * escaped, and ranges only ever name lines that exist in the emitted block.
 */
export function parseFenceMeta(value: string | undefined): FenceMeta | undefined {
  if (value === undefined) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(decodeEntities(value));
  } catch {
    return undefined;
  }
  const meta = recordOf(parsed);
  if (meta === undefined) return undefined;
  return {
    title: typeof meta.title === "string" && meta.title.trim() !== "" ? meta.title : null,
    highlight: rangesOf(meta.highlight),
    ins: rangesOf(meta.ins),
    del: rangesOf(meta.del),
    diff: meta.diff === true,
    showLineNumbers: meta.showLineNumbers === true,
    annotations: annotationsOf(meta.annotations),
  };
}
