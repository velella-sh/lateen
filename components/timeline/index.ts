import { h } from "preact";
import type { ComponentChildren } from "preact";
import type { ComponentProps, SiteConfig } from "@velella/mizzen/contracts";
import { t } from "../../i18n/index.ts";
import { calendarDate } from "../../src/dates.ts";
import { formatField, isEmpty } from "../../src/fields.ts";
import { selectRecords } from "../../src/records.ts";
import { DEFAULT_TONE, type StatusTone } from "../status/index.ts";
import { resolveStatus } from "../status/values.ts";
import table from "../table/index.ts";
import { scale } from "./scale.ts";

/** The Markdown directive this component handles: `::timeline{from="events"}`. */
export const directive = "timeline";

/** Class on the note shown instead of a table. */
export const ERROR_CLASS = "timeline-error";

/** Class on a cell whose row has no field. */
export const MISSING_CLASS = "timeline-missing";

/** Class on a cell whose date is not ISO 8601. */
export const INVALID_CLASS = "timeline-invalid";

/** Class on the decorative column that holds the axis and the bars. */
export const CHART_CLASS = "timeline-chart";

/** Class on the axis above the rows. */
export const AXIS_CLASS = "timeline-axis";

/** Class on one tick and its label. */
export const TICK_CLASS = "timeline-tick";

/** Class on a row's bar track. */
export const TRACK_CLASS = "timeline-track";

/** Class on one row's bar; the tone is appended: `timeline-bar-positive`. */
export const BAR_CLASS = "timeline-bar";

/** Class on one phase's segment in a row's track. */
export const PHASE_CLASS = "timeline-phase";

/** Class on the legend that names every phase and its tone. */
export const LEGEND_CLASS = "timeline-legend";

/** Marks the axis for the island that draws the current day, with `data-from`, `data-to` and `data-label`. */
export const TODAY_ATTRIBUTE = "data-timeline-today";

/** Marks the legend for the island, which adds the line's name there only when it draws the line. */
export const LEGEND_ATTRIBUTE = "data-timeline-legend";

/** Class on a bar whose end date is not known yet. */
export const OPEN_END_CLASS = "timeline-bar-open-end";

/** Class on a bar whose start date is not known. */
export const OPEN_START_CLASS = "timeline-bar-open-start";

/** Class on the text that says a date has no known value. */
export const ONGOING_CLASS = "timeline-ongoing";

/** Class on the message that reports overlapping phases in one row. */
export const OVERLAP_CLASS = "timeline-overlap";

/** Props from the directive or the page's front matter. */
export type TimelineProps = {
  /** The collection to read; required unless `items` is given. */
  from?: string;
  /** JSON array of rows, each with the label, start, end and status fields. */
  items?: string;
  /** The field holding a row's phases: a list of label, start, end and status objects; defaults to `phases`. */
  phases?: string;
  /** The field holding a row's label; defaults to `label`. */
  label?: string;
  /** The field holding a row's start date; defaults to `start`. */
  start?: string;
  /** The field holding a row's end date; defaults to `end`. */
  end?: string;
  /** The field holding a row's status; defaults to `status`. */
  status?: string;
  /** The table's caption, also its accessible name. */
  caption?: string;
};

/** One row's fields, and the URL of its page when the collection has one. */
interface Row {
  readonly fields: Readonly<Record<string, unknown>>;
  readonly url?: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

/** A JSON string as data, or undefined when it is not valid JSON. */
function parse(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return undefined;
  }
}

/** A field name from the directive, or its default when absent or blank. */
function fieldName(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : fallback;
}

/** Rows from a JSON array, or undefined when `items` is not an array of objects. */
function rowsOf(items: string): Row[] | undefined {
  const parsed = parse(items);
  if (!Array.isArray(parsed)) return undefined;
  return parsed.filter(isRecord).map((fields) => ({ fields }));
}

/** A percentage as a CSS length, rounded so two runs render the same bytes. */
function pct(value: number): string {
  return `${Math.round(value * 100) / 100}%`;
}

/** A tick's label: the year, or the year and quarter when the axis counts quarters. */
export function tickLabel(date: string, unit: "year" | "quarter"): string {
  const [year = date, month = "01"] = date.split("-");
  return unit === "year" ? year : `${year} Q${Math.floor((Number(month) - 1) / 3) + 1}`;
}

/** The tone of a row's status value, neutral when the row has none or the site maps none. */
function toneOfRow(row: Row, field: string, lang: string, config: SiteConfig | undefined): StatusTone {
  const value = row.fields[field];
  if (isEmpty(value)) return DEFAULT_TONE;
  return resolveStatus(String(value), lang, config).tone;
}

/** The field names the rows use, from the directive or their defaults. */
type Fields = {
  readonly label: string;
  readonly start: string;
  readonly end: string;
  readonly status: string;
  readonly phases: string;
};

const DAY = 86_400_000;

/** A value as epoch milliseconds at UTC midnight, or undefined when it is not an ISO 8601 date. */
function dayOf(value: unknown): number | undefined {
  const iso = typeof value === "string" ? calendarDate(value.trim(), "en")?.datetime : undefined;
  return iso === undefined ? undefined : Date.parse(iso);
}

/** The ISO date for a day. */
function iso(day: number): string {
  return new Date(day).toISOString().slice(0, 10);
}

/** A row's or a phase's dates as epoch days; a missing end runs to its start, and a bad date is ignored. */
function spanOf(row: Row, fields: Fields): { readonly from: number; readonly to: number } | undefined {
  const start = dayOf(row.fields[fields.start]);
  const end = dayOf(row.fields[fields.end]);
  const from = start ?? end;
  const to = end ?? start;
  return from === undefined || to === undefined ? undefined : { from, to };
}

/** The phases a row lists in its phases field; anything that is not a list of objects is ignored. */
function phasesOf(row: Row, field: string): Row[] {
  const value = row.fields[field];
  return Array.isArray(value) ? value.filter(isRecord).map((fields) => ({ fields })) : [];
}

/** One row's dates widened to its phases, so a phase never draws past the axis. */
function rangeOf(row: Row, phases: readonly Row[], fields: Fields): { start: string; end: string } | undefined {
  const spans = [spanOf(row, fields), ...phases.map((phase) => spanOf(phase, fields))].filter(
    (span): span is { readonly from: number; readonly to: number } => span !== undefined,
  );
  if (spans.length === 0) return undefined;
  return {
    start: iso(Math.min(...spans.map((span) => span.from))),
    end: iso(Math.max(...spans.map((span) => span.to))),
  };
}

/** A bar on the axis, with the ends that no date closes left open. */
type Segment = {
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
function segmentOf(
  row: Row,
  fields: Fields,
  axis: { readonly from: number; readonly span: number },
): Segment | undefined {
  const span = spanOf(row, fields);
  if (span === undefined) return undefined;
  const openStart = Object.hasOwn(row.fields, fields.start) && isEmpty(row.fields[fields.start]);
  const openEnd = Object.hasOwn(row.fields, fields.end) && isEmpty(row.fields[fields.end]);
  const from = openStart ? axis.from : span.from;
  const to = openEnd ? axis.from + axis.span : span.to + DAY;
  return {
    start: ((from - axis.from) / axis.span) * 100,
    length: ((to - from) / axis.span) * 100,
    openStart,
    openEnd,
  };
}

/** Each phase's bar on the axis; a phase without a real date has none. */
function segmentsOf(
  phases: readonly Row[],
  fields: Fields,
  axis: { readonly from: number; readonly span: number },
): (Segment | undefined)[] {
  return phases.map((phase) => segmentOf(phase, fields, axis));
}

/** A phase's name in the legend and the overlap message. */
function nameOf(phase: Row, fields: Fields, lang: string): string {
  const label = phase.fields[fields.label];
  return isEmpty(label) ? t(lang, "timeline_phase") : String(label);
}

/** The phases of one row that share a day with another phase in the same row. */
function overlaps(phases: readonly Row[], fields: Fields): Row[] {
  const spans = phases
    .map((phase) => ({ phase, span: spanOf(phase, fields) }))
    .filter(
      (item): item is { phase: Row; span: { readonly from: number; readonly to: number } } => item.span !== undefined,
    );
  const hit = new Set<Row>();
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

/** One legend entry: a phase's name and the tone its status resolves to. */
type LegendEntry = { readonly label: string; readonly tone: StatusTone };

/** Every phase once, in the order the rows list them. */
function legendOf(
  rows: readonly (readonly Row[])[],
  fields: Fields,
  lang: string,
  config: SiteConfig | undefined,
): LegendEntry[] {
  const entries: LegendEntry[] = [];
  const seen = new Set<string>();
  for (const phases of rows) {
    for (const phase of phases) {
      const label = nameOf(phase, fields, lang);
      if (seen.has(label)) continue;
      seen.add(label);
      entries.push({ label, tone: toneOfRow(phase, fields.status, lang, config) });
    }
  }
  return entries;
}

/** One bar in a row's track, phase segment or whole row; the tone is in the class. */
function bar(segment: Segment | undefined, tone: StatusTone, extra = ""): ComponentChildren {
  if (segment === undefined) return null;
  const open = [segment.openStart ? OPEN_START_CLASS : "", segment.openEnd ? OPEN_END_CLASS : ""];
  return h("span", {
    class: [BAR_CLASS, `${BAR_CLASS}-${tone}`, extra, ...open].filter((name) => name !== "").join(" "),
    style: `inset-inline-start:${pct(segment.start)};inline-size:${pct(segment.length)}`,
  });
}

/** A visible message for a field the row does not have. */
function missing(field: string, lang: string): ComponentChildren {
  return h("span", { class: MISSING_CLASS }, t(lang, "timeline_unknown_field", { name: field }));
}

/**
 * One cell. A date must be ISO 8601: a valid one renders as `<time>`, and an empty one as "ongoing"
 * rather than a blank cell, because a date with no value is an open end and not a mistake. A field
 * the row does not have is visible too.
 */
function cell(
  row: Row,
  field: string,
  kind: "date" | "status" | "text",
  lang: string,
  config: SiteConfig | undefined,
): ComponentChildren {
  if (!Object.hasOwn(row.fields, field)) return missing(field, lang);
  const value = row.fields[field];
  if (kind === "date" && isEmpty(value)) {
    return h("span", { class: ONGOING_CLASS }, t(lang, "timeline_ongoing"));
  }
  if (kind === "date") {
    const date = typeof value === "string" ? calendarDate(value, lang) : undefined;
    if (date === undefined) {
      return h(
        "span",
        { class: INVALID_CLASS },
        t(lang, "timeline_invalid_date", { name: field, value: String(value) }),
      );
    }
    return h("time", { datetime: date.datetime }, date.text);
  }
  return formatField(value, kind, lang, config);
}

/**
 * Timeline rows as a readable table: label, start, end and status. Rows come from a collection
 * (`from`) or from a JSON `items` attribute. An unknown collection, a missing field and a date that
 * is not ISO 8601 each show a visible message, so a typo never renders an empty timeline.
 */
export default function timeline({ props, page, site }: ComponentProps<Readonly<Record<string, unknown>>>) {
  const input = props as TimelineProps;
  const lang = page?.lang ?? "en";
  const caption = typeof input.caption === "string" ? input.caption.trim() : "";
  const fields: Fields = {
    label: fieldName(input.label, "label"),
    start: fieldName(input.start, "start"),
    end: fieldName(input.end, "end"),
    status: fieldName(input.status, "status"),
    phases: fieldName(input.phases, "phases"),
  };

  const from = typeof input.from === "string" ? input.from.trim() : "";
  const items = typeof input.items === "string" ? input.items.trim() : "";
  let rows: Row[] | undefined;

  if (from !== "") {
    const selection = selectRecords(site, page, { collection: from });
    if (!selection.ok) {
      const key =
        selection.error.code === "unknown-collection" ? "timeline_unknown_collection" : "timeline_unknown_field";
      return h("p", { class: ERROR_CLASS, role: "note" }, t(lang, key, { name: selection.error.name }));
    }
    rows = selection.records.map((record) => ({
      fields: record.fields,
      ...(record.url === undefined ? {} : { url: record.url }),
    }));
  } else if (items !== "") {
    rows = rowsOf(items);
  }

  if (rows === undefined) {
    return h("p", { class: ERROR_CLASS, role: "note" }, t(lang, "timeline_missing_setup"));
  }

  const config = site?.config;
  const phaseRows = rows.map((row) => phasesOf(row, fields.phases));
  const scaled = scale(rows.map((row, index) => rangeOf(row, phaseRows[index] ?? [], fields) ?? {}));
  const axis =
    scaled === undefined
      ? undefined
      : { from: Date.parse(scaled.from), span: Date.parse(scaled.to) - Date.parse(scaled.from) };
  // What the island reads to draw the reader's day; the build itself never reads the clock.
  const today =
    scaled === undefined
      ? {}
      : {
          "data-from": scaled.from,
          "data-to": scaled.to,
          "data-label": t(lang, "timeline_today"),
        };
  const legend = legendOf(phaseRows, fields, lang, config);
  const head = h(
    "thead",
    null,
    h(
      "tr",
      null,
      [
        ...[t(lang, "timeline_label"), t(lang, "timeline_start"), t(lang, "timeline_end"), t(lang, "timeline_status")].map(
          (label) => h("th", { scope: "col" }, label),
        ),
        // The axis is decoration over the dates the row cells state, so it names no column.
        scaled === undefined
          ? null
          : h(
              "th",
              { scope: "col", class: CHART_CLASS, "aria-hidden": "true" },
              h(
                "div",
                { class: AXIS_CLASS, [TODAY_ATTRIBUTE]: "", ...today },
                scaled.ticks.map((tick) =>
                  h(
                    "span",
                    { class: TICK_CLASS, style: `inset-inline-start:${pct(tick.position)}` },
                    tickLabel(tick.date, scaled.unit),
                  ),
                ),
              ),
            ),
      ],
    ),
  );

  const body = h(
    "tbody",
    null,
    rows.map((row, index) => {
      const label = cell(row, fields.label, "text", lang, config);
      const phases = phaseRows[index] ?? [];
      const segments = scaled === undefined || axis === undefined ? [] : segmentsOf(phases, fields, axis);
      const shared = overlaps(phases, fields);
      return [
        h(
          "tr",
          null,
          h(
            "td",
            { class: "timeline-cell", "data-field": "label" },
            row.url === undefined ? label : h("a", { href: row.url }, label as never),
          ),
          h("td", { class: "timeline-cell", "data-field": "start" }, cell(row, fields.start, "date", lang, config)),
          h("td", { class: "timeline-cell", "data-field": "end" }, cell(row, fields.end, "date", lang, config)),
          h("td", { class: "timeline-cell", "data-field": "status" }, cell(row, fields.status, "status", lang, config)),
          scaled === undefined || axis === undefined
            ? null
            : h(
                "td",
                { class: CHART_CLASS },
                h(
                  "div",
                  { class: TRACK_CLASS, "aria-hidden": "true" },
                  phases.length === 0
                    ? bar(segmentOf(row, fields, axis), toneOfRow(row, fields.status, lang, config))
                    : segments.map((segment, phaseIndex) => {
                        const phase = phases[phaseIndex];
                        return phase === undefined
                          ? null
                          : bar(segment, toneOfRow(phase, fields.status, lang, config), PHASE_CLASS);
                      }),
                ),
              ),
        ),
        shared.length === 0
          ? null
          : h(
              "tr",
              null,
              h(
                "td",
                { colspan: scaled === undefined ? 4 : 5 },
                h(
                  "span",
                  { class: OVERLAP_CLASS, role: "note" },
                  t(lang, "timeline_overlap", { names: shared.map((phase) => nameOf(phase, fields, lang)).join(", ") }),
                ),
              ),
            ),
      ];
    }),
  );

  const chart = h(
    table,
    (caption === "" ? {} : { label: caption }) as never,
    [caption === "" ? null : h("caption", null, caption), head, body] as never,
  );

  if (legend.length === 0) return chart;

  return [
    chart,
    h(
      "div",
      { class: LEGEND_CLASS, [LEGEND_ATTRIBUTE]: "", ...today },
      h("p", { class: "timeline-legend-title" }, t(lang, "timeline_legend")),
      h(
        "ul",
        null,
        legend.map((entry) =>
          h(
            "li",
            null,
            h("span", { class: `${BAR_CLASS} ${BAR_CLASS}-${entry.tone}`, "aria-hidden": "true" }),
            entry.label,
          ),
        ),
      ),
    ),
  ];
}
