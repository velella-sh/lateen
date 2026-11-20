/**
 * Fence metadata and the notes it carries. The engine writes one JSON value to `data-code` on every fence
 * with meta, already escaped for an HTML attribute, so the theme reads it there instead of parsing Markdown.
 */

import { parseJson } from "../../src/guards.ts";
import { t } from "../../i18n/index.ts";
import type { LineRange } from "./lines.ts";
import { decodeEntities, escapeHtml } from "./escape.ts";

/** Class on the notes' native disclosure, shown after the block. */
export const ANNOTATIONS_CLASS = "code-annotations";

/** Class on the disclosure's summary. */
export const SUMMARY_CLASS = "code-annotations-summary";

/** Class on the ordered list of notes. */
export const LIST_CLASS = "code-annotations-list";

/** Class on one note. */
export const ITEM_CLASS = "code-annotations-item";

/** Class on the note's line link. */
export const LINK_CLASS = "code-annotations-link";

/** Class on the note's text. */
export const TEXT_CLASS = "code-annotations-text";

/** The id of an annotated line's span: the block id plus the 1-based line number. */
export function lineId(block: string, line: number): string {
  return `${block}-line-${line}`;
}

/** A line-id callback that names only lines an annotation covers, so the code gets no text and no extra ids. */
export function annotationLineId(block: string, annotations: readonly CodeAnnotation[]): (line: number) => string | undefined {
  return (line) => (annotations.some((note) => line >= note.from && line <= note.to) ? lineId(block, line) : undefined);
}

/**
 * The notes as a native disclosure after the block: one summary, then an ordered list. Each note names its
 * line or range in a link to that line's span, followed by its text. Every value is escaped; nothing here
 * enters the `<pre>`, so copied code stays clean. Returns an empty string when there are no notes.
 */
export function renderAnnotations(annotations: readonly CodeAnnotation[], block: string, lang: string): string {
  if (annotations.length === 0) return "";
  const items = annotations
    .map((note) => {
      const label =
        note.from === note.to
          ? t(lang, "code_annotation_line", { line: note.from })
          : t(lang, "code_annotation_lines", { from: note.from, to: note.to });
      const link = `<a class="${LINK_CLASS}" href="#${lineId(block, note.from)}">${escapeHtml(label)}</a>`;
      return `<li class="${ITEM_CLASS}">${link} <span class="${TEXT_CLASS}">${escapeHtml(note.text)}</span></li>`;
    })
    .join("");
  const summary = escapeHtml(t(lang, "code_annotations", { count: annotations.length }));
  return `<details class="${ANNOTATIONS_CLASS}"><summary class="${SUMMARY_CLASS}">${summary}</summary><ol class="${LIST_CLASS}">${items}</ol></details>`;
}

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
  const meta = recordOf(parseJson(decodeEntities(value)));
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
