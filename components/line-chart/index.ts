import { h } from "preact";
import type { ComponentProps } from "@velella/mizzen/contracts";
import { calendarDay, calendarYear } from "../../src/dates.ts";
import { formatCount as formatNumber } from "../reading-time/index.ts";
import {
  idBaseOf,
  isJson,
  labelDir,
  lookup,
  numericValue,
  seriesColour,
  shortenLabel,
  text,
  type Json,
} from "../chart-data/input.ts";
import { scale } from "../timeline/scale.ts";
import chartData from "../chart-data/index.ts";
import { evenTicksOf, extentOf, paddedDomain, percentOf, percentScaleOf, ratioOf } from "../chart-data/scale.ts";
import { labelMark, lineMark, svgFrame, textMark } from "../chart-data/svg.ts";

// The table, its download links, and a missing value's note come from the shared chart-data path.
export { NO_VALUE_CLASS, NO_VALUE_TEXT, TABLE_CLASS } from "../chart-data/index.ts";

/** The Markdown directive this component handles: `::line-chart{from="growth"}`. */
export const directive = "line-chart";

/** The directive's options; the docs page and its test read this list. */
export const OPTIONS = ["from", "category", "value", "title", "id"] as const;

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

/** Class on the visible note shown when the source is absent or has nothing to draw. */
export const MISSING_CLASS = "line-chart-missing";

/** The name a chart without a title takes. */
export const DEFAULT_TITLE = "Line chart";

/** The most characters of a series name drawn at the end of its line; the table keeps the whole name. */
export const MAX_LABEL_LENGTH = 14;

/** What the chart says when it has no source to read. */
export const NO_SOURCE_TEXT = "This chart has no source.";

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
  return idBaseOf(raw, from, "line-chart");
}

/** A row's position value as an ISO day, or undefined when it is not one. */
function dateOf(value: unknown): string | undefined {
  return typeof value === "string" ? calendarDay(value.trim()) : undefined;
}

/** A number rounded so two runs render the same bytes. */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/** A date tick in the page's calendar and digits: the year, or the quarter within it. */
function dateTick(date: string, unit: "year" | "quarter", lang: string): string {
  const year = calendarYear(date, lang) ?? date.split("-")[0] ?? date;
  if (unit === "year") return year;
  const month = Number(date.split("-")[1] ?? "01");
  return `${year} Q${formatNumber(lang, Math.floor((month - 1) / 3) + 1)}`;
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
  const rtl = page.dir === "rtl";
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
  const numberExtent = extentOf(numbers);
  const numberMin = numberExtent?.low ?? 0;
  const numberMax = numberExtent?.high ?? 0;
  if (!dateMode && numberExtent === undefined) {
    return h("p", { class: MISSING_CLASS, role: "note" }, `${DEFAULT_TITLE}: no values in "${from}".`);
  }

  const axisStart = axis === undefined ? 0 : Date.parse(axis.from);
  const axisSpan = axis === undefined ? 1 : Date.parse(axis.to) - axisStart;
  // A single value sits mid-axis; any other value is its percentage of the domain's span.
  const position = (number: number): number =>
    numberMin === numberMax ? 50 : percentOf(number, numberMin, numberMax);
  const positionOf = (value: unknown): number | undefined => {
    if (axis !== undefined) {
      const date = dateOf(value);
      return date === undefined ? undefined : percentOf(Date.parse(date) - axisStart, 0, axisSpan);
    }
    const number = numericValue(value);
    return number === undefined ? undefined : position(number);
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
  const valueExtent = extentOf(values);
  if (valueExtent === undefined) {
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
              position: position(number),
              label: formatNumber(lang, number),
            }));
        })()
      : axis.ticks.map((tick) => ({
          position: tick.position,
          label: dateTick(tick.date, axis.unit, lang),
        }));

  const width = 720;
  const height = 260;
  // A time axis is never mirrored: time runs the way the page's calendar runs. Other charts start
  // on the reading side of a right-to-left page.
  const mirror = rtl && axis === undefined;
  const left = mirror ? 104 : 52;
  const right = width - (mirror ? 52 : 104);
  const top = 16;
  const bottom = height - 32;
  const plotWidth = right - left;
  const plotHeight = bottom - top;
  const xPx = percentScaleOf(mirror ? right : left, plotWidth, mirror);

  const { low, high } = paddedDomain(valueExtent.low, valueExtent.high);
  const yPx = (value: number): number => top + (1 - ratioOf(value, low, high)) * plotHeight;
  const yTicks = evenTicksOf(low, high);

  const marks = [];
  for (const tick of yTicks) {
    marks.push(lineMark(GRID_CLASS, left, right, round(yPx(tick)), round(yPx(tick))));
    marks.push(textMark(TICK_CLASS, mirror ? right + 8 : left - 8, round(yPx(tick)) + 4, mirror ? "start" : "end", formatNumber(lang, tick)));
  }
  marks.push(lineMark(AXIS_CLASS, left, right, bottom, bottom));
  for (const tick of xTicks) {
    marks.push(textMark(TICK_CLASS, round(xPx(tick.position)), bottom + 16, "middle", tick.label, labelDir(tick.label, rtl)));
  }

  const ends: { index: number; label: string; x: number; y: number }[] = [];
  series.forEach((entry, index) => {
    const seriesClass = `${CLASS}-series-${seriesColour(index)}`;
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
    const seriesClass = `${CLASS}-series-${seriesColour(end.index)}`;
    marks.push(
      labelMark(
        `${END_LABEL_CLASS} ${seriesClass}`,
        round(mirror ? end.x - 6 : end.x + 6),
        round(end.y + 4),
        mirror ? "end" : undefined,
        end.label,
        label,
        labelDir(label, rtl),
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
    svgFrame(SVG_CLASS, width, height, titleId, name, marks),
    chartData({
      title: name,
      description: `Values of ${fields.join(", ")} by ${category}, ${plotted.length} ${
        plotted.length === 1 ? "row" : "rows"
      }.`,
      labelHeading: CATEGORY_HEADING,
      columns: series.map((entry) => entry.label),
      rows: plotted.map(({ row, x }, index) => ({
        id: `${base}-${index + 1}`,
        label: x,
        values: series.map((entry) => numericValue(lookup(row, entry.field))),
      })),
      lang,
      id: base,
    }),
  );
}
