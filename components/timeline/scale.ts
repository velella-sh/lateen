import { calendarDay, calendarParts } from "../../src/dates.ts";
import { percentOf } from "../chart-data/scale.ts";

/** What the axis counts in: whole years, or quarters when the range is under two years. */
export type ScaleUnit = "year" | "quarter";

/** One row's dates as written; a value that is not a real date is ignored. */
export type ScaleRow = {
  readonly start?: unknown;
  readonly end?: unknown;
};

/** Explicit ends of the axis, so two timelines render on one scale. */
export type ScaleBounds = {
  readonly from?: unknown;
  readonly to?: unknown;
};

/** A tick on the axis. */
export type ScaleTick = {
  /** The tick's ISO date, `YYYY-MM-DD`. */
  readonly date: string;
  /** Where the tick sits, as a percentage of the axis. */
  readonly position: number;
};

/** A row's bar on the axis. */
export type ScaleSegment = {
  /** Where the bar starts, as a percentage of the axis. */
  readonly start: number;
  /** How wide the bar is, as a percentage of the axis. A one-day row still has a length. */
  readonly length: number;
};

/** The time axis, with percentages instead of pixels so it needs no DOM. */
export type Scale = {
  /** The axis start, an ISO date on a unit boundary. */
  readonly from: string;
  /** The axis end, an ISO date on a unit boundary; the last moment of the axis, not part of it. */
  readonly to: string;
  readonly unit: ScaleUnit;
  readonly ticks: readonly ScaleTick[];
  /** One segment per row, in row order; a row without a real date has none. */
  readonly segments: readonly (ScaleSegment | undefined)[];
};

/** One day in epoch milliseconds, the unit the axis counts in. */
export const DAY = 86_400_000;

/** A value as a real calendar day, in epoch milliseconds at UTC midnight, or undefined. */
export function dayOf(value: unknown): number | undefined {
  const iso = typeof value === "string" ? calendarDay(value.trim()) : undefined;
  return iso === undefined ? undefined : Date.parse(iso);
}

/** The ISO date for a day. */
export function iso(day: number): string {
  return new Date(day).toISOString().slice(0, 10);
}

/** The start of the year or quarter the day is in. */
function unitStart(day: number, unit: ScaleUnit): number {
  const date = new Date(day);
  if (unit === "year") return Date.UTC(date.getUTCFullYear(), 0, 1);
  return Date.UTC(date.getUTCFullYear(), Math.floor(date.getUTCMonth() / 3) * 3, 1);
}

/** The start of the year or quarter after the one the day is in. */
function unitNext(day: number, unit: ScaleUnit): number {
  const date = new Date(day);
  if (unit === "year") return Date.UTC(date.getUTCFullYear() + 1, 0, 1);
  return Date.UTC(date.getUTCFullYear(), Math.floor(date.getUTCMonth() / 3) * 3 + 3, 1);
}

/** Whole months between two days, used to pick the unit. */
function monthsBetween(from: number, to: number): number {
  const a = new Date(from);
  const b = new Date(to);
  return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
}

/** Enough days to reach the next unit in any calendar: a leap year, or a long lunar quarter. */
const UNIT_SPAN: Record<ScaleUnit, number> = { year: 400, quarter: 100 };

/** A day as one number, so two days compare in the page calendar's order. */
function calendarKey(day: number, lang: string): number {
  const parts = calendarParts(iso(day), lang);
  // `iso` always writes a real date, so the parts are always there.
  return parts === undefined ? Number.NaN : parts.year * 10_000 + parts.month * 100 + parts.day;
}

/** The first day in `[from, to]` whose calendar date is at or past `target`, or undefined if none is. */
function firstDay(from: number, to: number, target: number, lang: string): number | undefined {
  if (calendarKey(to, lang) < target) return undefined;
  let low = from;
  let high = to;
  while (low < high) {
    const middle = low + Math.floor((high - low) / DAY / 2) * DAY;
    if (calendarKey(middle, lang) >= target) high = middle;
    else low = middle + DAY;
  }
  return low;
}

/** The year and month a unit starts in, for the unit the calendar day is in. */
function calendarStart(
  parts: { readonly year: number; readonly month: number },
  unit: ScaleUnit,
): { readonly year: number; readonly month: number } {
  return unit === "year"
    ? { year: parts.year, month: 1 }
    : { year: parts.year, month: Math.floor((parts.month - 1) / 3) * 3 + 1 };
}

/** The year and month of the start of the unit after a unit start. */
function calendarNext(
  start: { readonly year: number; readonly month: number },
  unit: ScaleUnit,
): { readonly year: number; readonly month: number } {
  if (unit === "year") return { year: start.year + 1, month: 1 };
  return start.month + 3 > 12
    ? { year: start.year + 1, month: start.month - 9 }
    : { year: start.year, month: start.month + 3 };
}

/** The first day of each year or quarter of the page's calendar inside the axis. */
function ticksOf(
  from: number,
  to: number,
  unit: ScaleUnit,
  lang: string,
  percent: (day: number) => number,
): ScaleTick[] {
  const parts = calendarParts(iso(from), lang);
  if (parts === undefined) return [];

  const ticks: ScaleTick[] = [];
  let start = calendarStart(parts, unit);
  if (parts.day === 1 && parts.month === start.month) ticks.push({ date: iso(from), position: percent(from) });
  let last = from;
  for (;;) {
    const next = calendarNext(start, unit);
    const target = next.year * 10_000 + next.month * 100 + 1;
    const day = firstDay(last + DAY, last + UNIT_SPAN[unit] * DAY, target, lang);
    if (day === undefined || day >= to) return ticks;
    ticks.push({ date: iso(day), position: percent(day) });
    start = next;
    last = day;
  }
}

/**
 * The time axis for `rows`: their first and last dates rounded outward to whole years, or to
 * quarters when the range is under two years. Explicit `bounds` widen the axis so timelines can
 * share a scale. Ticks sit on the year or quarter boundaries of `lang`'s calendar while the axis
 * and its dates stay Gregorian. Tick positions and segment start and length are percentages of the
 * axis; a row with no real date is left out of the bounds rather than read as today. Undefined when
 * there is no date at all.
 */
export function scale(rows: readonly ScaleRow[], bounds: ScaleBounds = {}, lang = "en"): Scale | undefined {
  const ranges: readonly ({ readonly from: number; readonly to: number } | undefined)[] = rows.map((row) => {
    const start = dayOf(row.start);
    const end = dayOf(row.end);
    const from = start ?? end;
    const to = end ?? start;
    return from === undefined || to === undefined ? undefined : { from, to: to + DAY };
  });

  let first = Number.POSITIVE_INFINITY;
  let last = Number.NEGATIVE_INFINITY;
  for (const day of [bounds.from, bounds.to].map(dayOf)) {
    if (day === undefined) continue;
    first = Math.min(first, day);
    last = Math.max(last, day);
  }
  for (const segment of ranges) {
    if (segment === undefined) continue;
    first = Math.min(first, segment.from);
    last = Math.max(last, segment.to - DAY);
  }
  if (!Number.isFinite(first) || !Number.isFinite(last)) return undefined;

  const unit: ScaleUnit = monthsBetween(first, last) < 24 ? "quarter" : "year";
  const from = unitStart(first, unit);
  const to = unitNext(last, unit);
  const percent = (day: number) => percentOf(day, from, to);

  const ticks = ticksOf(from, to, unit, lang, percent);

  return {
    from: iso(from),
    to: iso(to),
    unit,
    ticks,
    segments: ranges.map((segment) =>
      segment === undefined
        ? undefined
        : { start: percent(segment.from), length: percent(segment.to) - percent(segment.from) },
    ),
  };
}
