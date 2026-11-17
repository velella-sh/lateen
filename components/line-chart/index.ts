import { h } from "preact";
import type { ComponentProps } from "@velella/mizzen/contracts";
import { calendarDate } from "../../src/dates.ts";
import { formatNumber } from "../../src/report.ts";
import { lookup, numericValue, shortenLabel } from "../bar-chart/index.ts";
import { tickLabel } from "../timeline/index.ts";
import { scale } from "../timeline/scale.ts";

/** The Markdown directive this component handles: `::line-chart{from="growth"}`. */
export const directive = "line-chart";

/** Class on the `<figure>`. `style.css` styles it. */
export const CLASS = "line-chart";

/** Class on the chart's title. */
export const TITLE_CLASS = "line-chart-title";

/** Class on the `<svg>`. */
export const SVG_CLASS = "line-chart-svg";

/** Class on one series' line. */
export const LINE_CLASS = "line-chart-line";

/** Class on a point, one per value the chart draws. */
export const POINT_CLASS = "line-chart-point";

/** Class on the axis line. */
export const AXIS_CLASS = "line-chart-axis";

/** Class on a grid line, one per tick. */
export const GRID_CLASS = "line-chart-grid";

/** Class on a tick label. */
export const TICK_CLASS = "line-chart-tick";

/** Class on the direct label at the end of a line. */
export const END_LABEL_CLASS = "line-chart-end-label";

/** Class on a gap and the table cell that stand for a row with no value. */
export const NO_VALUE_CLASS = "line-chart-no-value";

/** Class on the table under the chart, the chart's text alternative. */
export const TABLE_CLASS = "line-chart-table";

/** Class on the visible note shown when the source is absent or has nothing to draw. */
export const MISSING_CLASS = "line-chart-missing";

/** The name a chart without a title takes. */
export const DEFAULT_TITLE = "Line chart";

/** The most characters of a series name drawn at the end of its line; the table keeps the whole name. */
export const MAX_LABEL_LENGTH = 14;

/** What the chart says when it has no source to read. */
export const NO_SOURCE_TEXT = "This chart has no source.";

/** The note in the chart and in the table for a row with no value. */
export const NO_VALUE_TEXT = "No value";

/** Category heading of the table under the chart. */
export const CATEGORY_HEADING = "Category";

export type LineChartProps = {
  /** Collection name, or path in `_data` (dots or slashes), that holds the rows. */
  readonly from?: string;
  /** Field holding the position on the axis; defaults to `id`. A date or a number. */
  readonly category?: string;
  /** One or more fields holding the values, comma separated; defaults to `value`. Each is a series. */
  readonly value?: string;
  /** Title: the chart's accessible name and its caption. */
  readonly title?: string;
  /** Id of the figure; give one when two charts read the same source. */
  readonly id?: string;
};

/** One point: where it sits on the axis as a percentage, and its value when it has one. */
interface Point {
  readonly position: number;
  readonly value: number | undefined;
}

/** One series: the field it reads, the name at the end of its line, and its points in axis order. */
interface Series {
  readonly field: string;
  readonly label: string;
  readonly points: readonly Point[];
}

type Json = Readonly<Record<string, unknown>>;

function isJson(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Rows with their record id in the fields, from a collection or a list or keyed object in `_data`. */
export function rowsOf(
  site: ComponentProps<LineChartProps>["site"],
  from: string,
): Json[] | undefined {
  const collections = site.collections ?? {};
  const collection = Object.hasOwn(collections, from) ? collections[from] : undefined;
  if (collection !== undefined) {
    return collection.records.map((record) => ({ ...record.fields, id: record.id }));
  }
  const found = lookup(site.data, from);
  if (Array.isArray(found)) {
    return found.flatMap((entry, index) =>
      isJson(entry) ? [{ ...entry, id: String(entry.id ?? index + 1) }] : [],
    );
  }
  if (isJson(found)) {
    return Object.entries(found).flatMap(([id, entry]) => (isJson(entry) ? [{ ...entry, id }] : []));
  }
  return undefined;
}

/** The series fields the `value` attribute names; an empty list means the `value` field. */
export function seriesOf(raw: string): string[] {
  const fields = raw
    .split(",")
    .map((field) => field.trim())
    .filter((field) => field !== "");
  return fields.length === 0 ? ["value"] : fields;
}

/** The id prefix of the chart: the `id` prop, or its source path. */
export function idBase(raw: unknown, from: string): string {
  const given = text(raw);
  const source = given === "" ? `line-chart-${from}` : given;
  const slug = source
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_-]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug === "" ? "line-chart" : slug;
}

/** A row's position value as an ISO date, or undefined when it is not one. */
function dateOf(value: unknown): string | undefined {
  return typeof value === "string" ? calendarDate(value.trim(), "en")?.datetime : undefined;
}

/** A number rounded so two runs render the same bytes. */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * `::line-chart{from="growth" category="date" value="north,south" title="Growth"}` draws one or more
 * series as fixed SVG written at build time: no script, no fetch, and no computation on the reader's
 * device. A date axis uses the timeline's scale and ticks; a numeric axis fits the values. A missing
 * value breaks the line instead of joining across it, and each line is labelled at its end. The table
 * under the chart is the text alternative and shows every plotted row.
 */
export default function lineChart({ props, site, page }: ComponentProps<LineChartProps>) {
  const from = text(props.from);
  if (from === "") return h("p", { class: MISSING_CLASS, role: "note" }, NO_SOURCE_TEXT);

  const rows = rowsOf(site, from);
  if (rows === undefined || rows.length === 0) {
    return h("p", { class: MISSING_CLASS, role: "note" }, `${DEFAULT_TITLE}: no rows in "${from}".`);
  }

  const category = text(props.category) || "id";
  const fields = seriesOf(text(props.value));
  const lang = page.lang;
  const xOf = (row: Json): unknown => lookup(row, category);

  const known = rows
    .map(xOf)
    .filter((value) => value !== undefined && value !== null && String(value).trim() !== "");
  const dateMode = known.length > 0 && known.every((value) => dateOf(value) !== undefined);
  const axis = dateMode
    ? scale(
        known.flatMap((value) => {
          const date = dateOf(value);
          return date === undefined ? [] : [{ start: date, end: date }];
        }),
      )
    : undefined;
  if (dateMode && axis === undefined) {
    return h("p", { class: MISSING_CLASS, role: "note" }, `${DEFAULT_TITLE}: no values in "${from}".`);
  }

  const numbers = dateMode
    ? []
    : known.flatMap((value) => {
        const number = numericValue(value);
        return number === undefined ? [] : [number];
      });
  const numberMin = Math.min(...numbers);
  const numberMax = Math.max(...numbers);
  if (!dateMode && numbers.length === 0) {
    return h("p", { class: MISSING_CLASS, role: "note" }, `${DEFAULT_TITLE}: no values in "${from}".`);
  }

  const axisStart = axis === undefined ? 0 : Date.parse(axis.from);
  const axisSpan = axis === undefined ? 1 : Date.parse(axis.to) - axisStart;
  const positionOf = (value: unknown): number | undefined => {
    if (axis !== undefined) {
      const date = dateOf(value);
      return date === undefined ? undefined : ((Date.parse(date) - axisStart) / axisSpan) * 100;
    }
    const number = numericValue(value);
    if (number === undefined) return undefined;
    return numberMin === numberMax ? 50 : ((number - numberMin) / (numberMax - numberMin)) * 100;
  };

  const series: Series[] = fields.map((field) => ({
    field,
    label: field,
    points: rows
      .flatMap((row) => {
        const position = positionOf(xOf(row));
        return position === undefined ? [] : [{ position, value: numericValue(lookup(row, field)) }];
      })
      .sort((a, b) => a.position - b.position),
  }));

  const values = series.flatMap((entry) =>
    entry.points.flatMap((point) => (point.value === undefined ? [] : [point.value])),
  );
  if (values.length === 0) {
    return h("p", { class: MISSING_CLASS, role: "note" }, `${DEFAULT_TITLE}: no values in "${from}".`);
  }

  const xTicks =
    axis === undefined
      ? (() => {
          const unique = [...new Set(numbers)].sort((a, b) => a - b);
          const step = Math.max(1, Math.ceil(unique.length / 8));
          return unique
            .filter((_, index) => index % step === 0)
            .map((number) => ({
              position: numberMin === numberMax ? 50 : ((number - numberMin) / (numberMax - numberMin)) * 100,
              label: formatNumber(lang, number),
            }));
        })()
      : axis.ticks.map((tick) => ({
          position: tick.position,
          label: tickLabel(tick.date, axis.unit),
        }));

  const width = 720;
  const height = 260;
  const left = 52;
  const right = width - 104;
  const top = 16;
  const bottom = height - 32;
  const plotWidth = right - left;
  const plotHeight = bottom - top;
  const xPx = (position: number): number => left + (position / 100) * plotWidth;

  let low = Math.min(...values);
  let high = Math.max(...values);
  if (low === high) {
    low -= 1;
    high += 1;
  }
  const yPx = (value: number): number => top + (1 - (value - low) / (high - low)) * plotHeight;
  const yTicks = Array.from({ length: 5 }, (_, index) =>
    Number((low + ((high - low) * index) / 4).toPrecision(12)),
  );

  const marks = [];
  for (const tick of yTicks) {
    marks.push(h("line", { class: GRID_CLASS, x1: left, x2: right, y1: round(yPx(tick)), y2: round(yPx(tick)) }));
    marks.push(
      h(
        "text",
        { class: TICK_CLASS, x: left - 8, y: round(yPx(tick)) + 4, "text-anchor": "end" },
        formatNumber(lang, tick),
      ),
    );
  }
  marks.push(h("line", { class: AXIS_CLASS, x1: left, x2: right, y1: bottom, y2: bottom }));
  for (const tick of xTicks) {
    marks.push(
      h(
        "text",
        { class: TICK_CLASS, x: round(xPx(tick.position)), y: bottom + 16, "text-anchor": "middle" },
        tick.label,
      ),
    );
  }

  const ends: { index: number; label: string; x: number; y: number }[] = [];
  series.forEach((entry, index) => {
    const seriesClass = `${CLASS}-series-${(index % 8) + 1}`;
    let drawing = false;
    let d = "";
    for (const point of entry.points) {
      if (point.value === undefined) {
        drawing = false;
        continue;
      }
      d += `${drawing ? "L" : "M"}${round(xPx(point.position))} ${round(yPx(point.value))}`;
      drawing = true;
      marks.push(
        h("circle", {
          class: `${POINT_CLASS} ${seriesClass}`,
          cx: round(xPx(point.position)),
          cy: round(yPx(point.value)),
          r: 3,
        }),
      );
    }
    if (d !== "") {
      marks.push(h("path", { class: `${LINE_CLASS} ${seriesClass}`, d, "data-series": entry.field }));
    }
    const last = entry.points.at(-1);
    if (last !== undefined && last.value !== undefined) {
      ends.push({ index, label: entry.label, x: xPx(last.position), y: yPx(last.value) });
    }
  });

  // Labels at line ends share the plot's height, so nudge a label down when another sits at its side.
  ends.sort((a, b) => a.y - b.y);
  let floor = Number.NEGATIVE_INFINITY;
  for (const end of ends) {
    end.y = Math.min(Math.max(end.y, floor + 12), bottom);
    floor = end.y;
    const label = shortenLabel(end.label, MAX_LABEL_LENGTH);
    const seriesClass = `${CLASS}-series-${(end.index % 8) + 1}`;
    marks.push(
      h(
        "text",
        { class: `${END_LABEL_CLASS} ${seriesClass}`, x: round(end.x + 6), y: round(end.y + 4) },
        label === end.label ? null : h("title", null, end.label),
        label,
      ),
    );
  }

  const title = text(props.title);
  const name = title === "" ? `${DEFAULT_TITLE}: ${from}` : title;
  const base = idBase(props.id, from);
  const titleId = `${base}-title`;
  const plotted = rows.flatMap((row) => {
    const raw = xOf(row);
    return positionOf(raw) === undefined
      ? []
      : [{ row, x: axis === undefined ? formatNumber(lang, numericValue(raw) ?? 0) : (dateOf(raw) ?? String(raw)) }];
  });

  return h(
    "figure",
    { class: CLASS, id: base, "data-line-chart": from },
    title === "" ? null : h("figcaption", { class: TITLE_CLASS }, title),
    h(
      "svg",
      {
        class: SVG_CLASS,
        viewBox: `0 0 ${width} ${height}`,
        role: "img",
        "aria-labelledby": titleId,
        preserveAspectRatio: "xMidYMid meet",
      },
      h("title", { id: titleId }, name),
      ...marks,
    ),
    h(
      "table",
      { class: TABLE_CLASS },
      h("caption", null, name),
      h(
        "thead",
        null,
        h(
          "tr",
          null,
          h("th", { scope: "col" }, CATEGORY_HEADING),
          ...series.map((entry) => h("th", { scope: "col" }, entry.label)),
        ),
      ),
      h(
        "tbody",
        null,
        ...plotted.map(({ row, x }) =>
          h(
            "tr",
            null,
            h("th", { scope: "row" }, x),
            ...series.map((entry) => {
              const value = numericValue(lookup(row, entry.field));
              return value === undefined
                ? h("td", { class: NO_VALUE_CLASS }, NO_VALUE_TEXT)
                : h("td", null, formatNumber(lang, value));
            }),
          ),
        ),
      ),
    ),
  );
}
