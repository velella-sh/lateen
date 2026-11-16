/**
 * The source span the engine writes into `data-src`: `path:line:column-endLine:endColumn`, with the end
 * inclusive, or one of the two point forms `path:line` and `path:line:column`. This module only reads the
 * attribute; the engine owns its format. Browser islands import it, so it has no imports and no DOM.
 */

/** One source span; lines and columns are 1-based and the end is inclusive. */
export interface Span {
  readonly file: string;
  readonly line: number;
  readonly column: number;
  readonly endLine: number;
  readonly endColumn: number;
}

const FULL_SPAN = /^(.*):(\d+):(\d+)-(\d+):(\d+)$/;
const POINT_WITH_COLUMN = /^(.*):(\d+):(\d+)$/;
const POINT = /^(.*):(\d+)$/;

/** Every part of a span is at least 1: lines and columns are 1-based. */
function positive(...values: readonly number[]): boolean {
  return values.every((value) => Number.isInteger(value) && value >= 1);
}

/** A span from its parts, or `undefined` when one is missing or the end runs before the start. */
function spanOfParts(
  file: string | undefined,
  line: number,
  column: number,
  endLine: number,
  endColumn: number,
): Span | undefined {
  if (!file || !positive(line, column, endLine, endColumn)) return undefined;
  if (endLine < line || (endLine === line && endColumn < column)) return undefined;
  return { file, line, column, endLine, endColumn };
}

/**
 * Parses a `data-src` value. Numbers are taken from the right, so a path may contain a colon. A point form
 * has its end equal to its start. A malformed value (no file, a zero or non-numeric part, an end before the
 * start, anything that is not a string) returns `undefined` rather than a guess.
 */
export function parseSpan(value: unknown): Span | undefined {
  if (typeof value !== "string") return undefined;
  const full = FULL_SPAN.exec(value);
  if (full) {
    return spanOfParts(full[1], Number(full[2]), Number(full[3]), Number(full[4]), Number(full[5]));
  }

  const withColumn = POINT_WITH_COLUMN.exec(value);
  if (withColumn) {
    const line = Number(withColumn[2]);
    const column = Number(withColumn[3]);
    return spanOfParts(withColumn[1], line, column, line, column);
  }

  const point = POINT.exec(value);
  if (point) {
    const line = Number(point[2]);
    return spanOfParts(point[1], line, 1, line, 1);
  }

  return undefined;
}

/** `file:line` for a span: where a reader looks for the block's first line. */
export function locationOf(span: Span): string {
  return `${span.file}:${span.line}`;
}
