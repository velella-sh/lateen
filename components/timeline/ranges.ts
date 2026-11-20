import { calendarParts, calendarYear } from "../../src/dates.ts";
import { isEmpty } from "../../src/fields.ts";
import { percentOf } from "../chart-data/scale.ts";
import { DAY, dayOf, iso } from "./scale.ts";

export { DAY, dayOf, iso };

/**
 * The timeline's date arithmetic, with no rendering: date conversion, spans, the axis range,
 * phase segments, overlaps and tick labels. Every function is pure data in, data out, so the
 * calculations can be tested and reused without a DOM or a component tree.
 */

/** One row's or phase's fields as data; where its page lives is the renderer's concern. */
export type DateRow = { readonly fields: Readonly<Record<string, unknown>> };

/** The field names holding a row's start and end dates. */
export type DateFields = { readonly start: string; readonly end: string };

/** The axis a segment is placed on: its first day and its length, in epoch milliseconds. */
export type Axis = { readonly from: number; readonly span: number };

/** A span of whole days, in epoch milliseconds at UTC midnight; both ends are days the row covers. */
export type Span = { readonly from: number; readonly to: number };

/** A row's or a phase's dates as epoch days; a missing end runs to its start, and a bad date is ignored. */
export function spanOf(row: DateRow, fields: DateFields): Span | undefined {
  const start = dayOf(row.fields[fields.start]);
  const end = dayOf(row.fields[fields.end]);
  const from = start ?? end;
  const to = end ?? start;
  return from === undefined || to === undefined ? undefined : { from, to };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

/** The phases a row lists in its phases field; anything that is not a list of objects is ignored. */
export function phasesOf(row: DateRow, field: string): DateRow[] {
  const value = row.fields[field];
  return Array.isArray(value) ? value.filter(isRecord).map((fields) => ({ fields })) : [];
}

/** One row's dates widened to its phases, so a phase never draws past the axis. */
export function rangeOf(
  row: DateRow,
  phases: readonly DateRow[],
  fields: DateFields,
): { start: string; end: string } | undefined {
  const spans = [spanOf(row, fields), ...phases.map((phase) => spanOf(phase, fields))].filter(
    (span): span is Span => span !== undefined,
  );
  if (spans.length === 0) return undefined;
  return {
    start: iso(Math.min(...spans.map((span) => span.from))),
    end: iso(Math.max(...spans.map((span) => span.to))),
  };
}

/** A bar on the axis, with the ends that no date closes left open. */
export type Segment = {
  readonly start: number;
  readonly length: number;
  readonly openStart: boolean;
  readonly openEnd: boolean;
};

/**
 * A row's or a phase's dates as a bar on the axis. An empty date leaves its end open and runs it to
 * the edge of the axis; no end date is ever made up. A field the row does not have stays a visible
 * message, so a mistyped field name is never read as ongoing.
 */
export function segmentOf(row: DateRow, fields: DateFields, axis: Axis): Segment | undefined {
  const span = spanOf(row, fields);
  if (span === undefined) return undefined;
  const openStart = Object.hasOwn(row.fields, fields.start) && isEmpty(row.fields[fields.start]);
  const openEnd = Object.hasOwn(row.fields, fields.end) && isEmpty(row.fields[fields.end]);
  const from = openStart ? axis.from : span.from;
  const to = openEnd ? axis.from + axis.span : span.to + DAY;
  return {
    start: percentOf(from - axis.from, 0, axis.span),
    length: percentOf(to - from, 0, axis.span),
    openStart,
    openEnd,
  };
}

/** Each phase's bar on the axis; a phase without a real date has none. */
export function segmentsOf(phases: readonly DateRow[], fields: DateFields, axis: Axis): (Segment | undefined)[] {
  return phases.map((phase) => segmentOf(phase, fields, axis));
}

/** The phases of one row that share a day with another phase in the same row, in the order listed. */
export function overlaps<T extends DateRow>(phases: readonly T[], fields: DateFields): T[] {
  const spans = phases
    .map((phase) => ({ phase, span: spanOf(phase, fields) }))
    .filter((item): item is { phase: T; span: Span } => item.span !== undefined);
  const hit = new Set<T>();
  for (const [index, a] of spans.entries()) {
    for (const b of spans.slice(index + 1)) {
      if (a.span.from <= b.span.to && b.span.from <= a.span.to) {
        hit.add(a.phase);
        hit.add(b.phase);
      }
    }
  }
  return phases.filter((phase) => hit.has(phase));
}

/** A tick's label: the year, or the year and quarter, in the page's calendar and digits. */
export function tickLabel(date: string, unit: "year" | "quarter", lang: string): string {
  const year = calendarYear(date, lang) ?? date.split("-")[0] ?? date;
  if (unit === "year") return year;
  const month = calendarParts(date, lang)?.month ?? 1;
  const quarter = new Intl.NumberFormat(lang, { useGrouping: false }).format(Math.floor((month - 1) / 3) + 1);
  return `${year} Q${quarter}`;
}