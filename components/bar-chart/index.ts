import { h } from "preact";
import type { ComponentProps } from "@velella/mizzen/contracts";
import { formatCount as formatNumber } from "../reading-time/index.ts";
import chartData from "../chart-data/index.ts";

/** The Markdown directive this component handles: `::bar-chart{from="sales"}`. */
export const directive = "bar-chart";

/** Class on the `<figure>`. `style.css` styles it. */
export const CLASS = "bar-chart";

/** Class on the chart's title. */
export const TITLE_CLASS = "bar-chart-title";

/** Class on the `<svg>`. */
export const SVG_CLASS = "bar-chart-svg";

/** Class on a bar. Its fill comes from the chart colour tokens, never from status or state. */
export const BAR_CLASS = "bar-chart-bar";

/** Class on the axis line. */
export const AXIS_CLASS = "bar-chart-axis";

/** Class on a grid line, one per tick. */
export const GRID_CLASS = "bar-chart-grid";

/** Class on a tick label. */
export const TICK_CLASS = "bar-chart-tick";

/** Class on a category label. */
export const LABEL_CLASS = "bar-chart-label";

/** Class on the value written at the end of a bar. */
export const VALUE_CLASS = "bar-chart-value";

/** Class on the gap and the table cell that stand for a row with no value. */
export const NO_VALUE_CLASS = "bar-chart-no-value";

/** Class on the visible note shown when the source is absent or empty. */
export const MISSING_CLASS = "bar-chart-missing";

/** The directions a chart can draw: bars run along the inline axis, or along the block axis. */
export const DIRECTIONS = ["horizontal", "vertical"] as const;
export type Direction = (typeof DIRECTIONS)[number];

export type BarChartProps = {
  /** Collection name, or path in `_data` (dots or slashes), that holds the rows. */
  readonly from?: string;
  /** Field holding the category label; defaults to `id`. Nested fields use dots. */
  readonly category?: string;
  /** Field holding the number; defaults to `value`. */
  readonly value?: string;
  /** `horizontal` (the default) or `vertical`. */
  readonly direction?: string;
  /** Title: the chart's accessible name and its caption. */
  readonly title?: string;
  /** Id of the figure; give one when two charts read the same source. */
  readonly id?: string;
};

/** What the chart says when it has no source to read. */
export const NO_SOURCE_TEXT = "This chart has no source.";

/** The note in the chart and in the table for a row with no value. */
export const NO_VALUE_TEXT = "No value";

/** The name a chart without a title takes. */
export const DEFAULT_TITLE = "Bar chart";

/** Category and value headings of the table under the chart. */
export const CATEGORY_HEADING = "Category";
export const VALUE_HEADING = "Value";

/** The longest category label drawn in the SVG; the table always shows the whole label. */
export const MAX_LABEL_LENGTH = 28;

/** The longest category label drawn under a vertical bar. */
export const MAX_VERTICAL_LABEL_LENGTH = 12;

/** One row of the chart: its identity, its full label, and its value when it has one. */
export interface BarRow {
  readonly id: string;
  readonly label: string;
  readonly value: number | undefined;
}

type Json = Readonly<Record<string, unknown>>;

function isJson(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** The value at a dotted path inside a row, or undefined when the path does not resolve. */
function resolveIn(row: Json, path: string): unknown {
  let node: unknown = row;
  for (const key of path.split(".").filter((part) => part !== "")) {
    if (!isJson(node) || !Object.hasOwn(node, key)) return undefined;
    node = node[key];
  }
  return node;
}

/** The value at a dotted or slashed path inside `_data`, or undefined when it does not resolve. */
export function lookup(data: Readonly<Record<string, unknown>>, path: string): unknown {
  let node: unknown = data;
  for (const key of path.split(/[./]/).filter((part) => part !== "")) {
    if (!isJson(node) || !Object.hasOwn(node, key)) return undefined;
    node = node[key];
  }
  return node;
}

/** A number from a number or a numeric string; anything else, including an empty cell, has no value. */
export function numericValue(raw: unknown): number | undefined {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : undefined;
  if (typeof raw === "string" && raw.trim() !== "") {
    const parsed = Number(raw.trim());
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function rowOf(id: string, fields: Json, category: string, value: string): BarRow {
  const rawLabel = resolveIn(fields, category);
  const label = typeof rawLabel === "string" || typeof rawLabel === "number" ? String(rawLabel) : id;
  return { id, label: label === "" ? id : label, value: numericValue(resolveIn(fields, value)) };
}

/**
 * The rows a chart reads: a collection's records, or a list or keyed object in `_data`. Every row keeps
 * its record's id and its whole label. `undefined` means the source names neither, which the chart
 * reports instead of drawing an empty frame.
 */
export function rowsOf(
  site: ComponentProps<BarChartProps>["site"],
  from: string,
  category: string,
  value: string,
): BarRow[] | undefined {
  const collections = site.collections ?? {};
  const collection = Object.hasOwn(collections, from) ? collections[from] : undefined;
  if (collection !== undefined) {
    return collection.records.map((record) =>
      rowOf(record.id, { ...record.fields, id: record.id }, category, value),
    );
  }
  const found = lookup(site.data, from);
  if (Array.isArray(found)) {
    return found.flatMap((entry, index) => (isJson(entry) ? [rowOf(String(entry.id ?? index + 1), entry, category, value)] : []));
  }
  if (isJson(found)) {
    return Object.entries(found).flatMap(([id, entry]) =>
      isJson(entry) ? [rowOf(id, { ...entry, id }, category, value)] : [],
    );
  }
  return undefined;
}

/** A label cut to `max` characters, with an ellipsis; the table under the chart keeps the whole label. */
export function shortenLabel(label: string, max = MAX_LABEL_LENGTH): string {
  const characters = Array.from(label);
  return characters.length <= max ? label : `${characters.slice(0, max - 1).join("")}…`;
}

/**
 * `dir="ltr"` for a Latin label on a right-to-left page: it states its own direction, so the words
 * keep their order inside the page's right-to-left text. A label in an Arabic or Hebrew script, or one
 * with no letters, keeps the page's direction.
 */
export function labelDir(label: string, rtl: boolean): "ltr" | undefined {
  return rtl && /\p{Script=Latin}/u.test(label) && !/[\p{Script=Arabic}\p{Script=Hebrew}]/u.test(label)
    ? "ltr"
    : undefined;
}

/** A round step near `span / count`: 1, 2, 5, or 10 times a power of ten. */
function niceStep(span: number, count: number): number {
  const rough = span / Math.max(1, count);
  const power = 10 ** Math.floor(Math.log10(rough));
  const error = rough / power;
  const factor = error < 1.5 ? 1 : error < 3 ? 2 : error < 7 ? 5 : 10;
  return factor * power;
}

/**
 * The tick values for a data range: round steps that include zero, the range's ends, and no tick
 * nobody asked for. A range with one value still gets a second end, so a single bar reads on a scale.
 */
export function ticksOf(min: number, max: number, count = 5): number[] {
  const low = Math.min(0, Number.isFinite(min) ? min : 0);
  const high = Math.max(0, Number.isFinite(max) ? max : 0);
  const span = high - low === 0 ? 1 : high - low;
  const step = niceStep(span, count);
  const start = Math.floor(low / step) * step;
  const end = Math.ceil((low + span) / step) * step;
  const ticks: number[] = [];
  for (let value = start; value <= end + step / 2; value += step) {
    ticks.push(Number(value.toPrecision(12)));
  }
  return ticks;
}

/** The direction the directive asked for; an unknown value falls back to horizontal. */
export function directionOf(raw: unknown): Direction {
  return typeof raw === "string" && (DIRECTIONS as readonly string[]).includes(raw.trim().toLowerCase())
    ? (raw.trim().toLowerCase() as Direction)
    : "horizontal";
}

/** A value reduced to letters, digits, `-` and `_`, so it can go in an id. */
function slugOf(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_-]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** The id prefix of the chart: the `id` prop, or its source path. */
export function idBase(raw: unknown, from: string): string {
  const given = slugOf(text(raw));
  if (given !== "") return given;
  const source = slugOf(from);
  return source === "" ? "bar-chart" : `bar-chart-${source}`;
}

/** The marks and size of a horizontal chart: labels at the inline start, bars along the inline axis. */
function horizontalChart(rows: readonly BarRow[], ticks: readonly number[], lang: string, rtl: boolean) {
  const width = 720;
  const rowHeight = 28;
  const barHeight = 16;
  const labelWidth = 168;
  const valueGutter = 72;
  const labelGutter = 12 + labelWidth + 8;
  const plotX = rtl ? valueGutter : labelGutter;
  const plotWidth = width - labelGutter - valueGutter;
  const plotTop = 12;
  const plotBottom = plotTop + rows.length * rowHeight;
  const height = plotBottom + 30;
  const low = ticks[0] ?? 0;
  const high = ticks[ticks.length - 1] ?? 1;
  // On a right-to-left page the axis starts at the right edge, so values grow toward the left.
  const x = (value: number): number => {
    const ratio = (value - low) / (high - low || 1);
    return rtl ? plotX + plotWidth * (1 - ratio) : plotX + plotWidth * ratio;
  };
  const marks = [];

  for (const tick of ticks) {
    marks.push(h("line", { class: GRID_CLASS, x1: x(tick), x2: x(tick), y1: plotTop, y2: plotBottom }));
  }
  marks.push(
    h("line", { class: AXIS_CLASS, x1: plotX, x2: plotX + plotWidth, y1: plotBottom, y2: plotBottom }),
  );
  for (const tick of ticks) {
    marks.push(
      h("text", { class: TICK_CLASS, x: x(tick), y: plotBottom + 16, "text-anchor": "middle" }, formatNumber(lang, tick)),
    );
  }

  rows.forEach((row, index) => {
    const center = plotTop + index * rowHeight + rowHeight / 2;
    const short = shortenLabel(row.label);
    marks.push(
      h(
        "text",
        {
          class: LABEL_CLASS,
          x: rtl ? width - 12 : plotX - 8,
          y: center + 4,
          "text-anchor": rtl ? "start" : "end",
          dir: labelDir(row.label, rtl),
        },
        short === row.label ? null : h("title", null, row.label),
        short,
      ),
    );
    if (row.value === undefined) {
      marks.push(
        h(
          "text",
          {
            class: NO_VALUE_CLASS,
            x: rtl ? plotX + plotWidth - 4 : plotX + 4,
            y: center + 4,
            "text-anchor": rtl ? "end" : "start",
          },
          NO_VALUE_TEXT,
        ),
      );
      return;
    }
    const zero = x(0);
    const end = x(row.value);
    marks.push(
      h("rect", {
        class: BAR_CLASS,
        x: Math.min(zero, end),
        y: center - barHeight / 2,
        width: Math.abs(end - zero),
        height: barHeight,
      }),
    );
    const positive = row.value >= 0;
    // The value label sits beyond the bar's end, on whichever side the axis grows.
    const side = (positive ? 1 : -1) * (rtl ? -1 : 1);
    marks.push(
      h(
        "text",
        {
          class: VALUE_CLASS,
          x: end + side * 6,
          y: center + 4,
          "text-anchor": side > 0 ? "start" : "end",
        },
        formatNumber(lang, row.value),
      ),
    );
  });

  return { width, height, marks };
}

/** The marks and size of a vertical chart: categories along the axis, bars rising from zero. */
function verticalChart(rows: readonly BarRow[], ticks: readonly number[], lang: string, rtl: boolean) {
  const width = 720;
  const left = rtl ? 16 : 48;
  const right = rtl ? 48 : 16;
  const plotTop = 16;
  const plotHeight = 200;
  const baseline = plotTop + plotHeight;
  const height = baseline + 36;
  const low = ticks[0] ?? 0;
  const high = ticks[ticks.length - 1] ?? 1;
  const slot = (width - left - right) / Math.max(1, rows.length);
  const barWidth = Math.min(56, Math.max(8, slot * 0.6));
  const y = (value: number): number => plotTop + ((high - value) / (high - low || 1)) * plotHeight;
  const marks = [];

  for (const tick of ticks) {
    marks.push(h("line", { class: GRID_CLASS, x1: left, x2: width - right, y1: y(tick), y2: y(tick) }));
    marks.push(
      h(
        "text",
        {
          class: TICK_CLASS,
          x: rtl ? width - right + 8 : left - 8,
          y: y(tick) + 4,
          "text-anchor": rtl ? "start" : "end",
        },
        formatNumber(lang, tick),
      ),
    );
  }
  marks.push(h("line", { class: AXIS_CLASS, x1: left, x2: width - right, y1: baseline, y2: baseline }));

  rows.forEach((row, index) => {
    const center = left + (rtl ? rows.length - 1 - index : index) * slot + slot / 2;
    const short = shortenLabel(row.label, MAX_VERTICAL_LABEL_LENGTH);
    marks.push(
      h(
        "text",
        {
          class: LABEL_CLASS,
          x: center,
          y: baseline + 18,
          "text-anchor": "middle",
          dir: labelDir(row.label, rtl),
        },
        short === row.label ? null : h("title", null, row.label),
        short,
      ),
    );
    if (row.value === undefined) {
      marks.push(h("text", { class: NO_VALUE_CLASS, x: center, y: baseline - 6, "text-anchor": "middle" }, NO_VALUE_TEXT));
      return;
    }
    const zero = y(0);
    const end = y(row.value);
    marks.push(
      h("rect", {
        class: BAR_CLASS,
        x: center - barWidth / 2,
        y: Math.min(zero, end),
        width: barWidth,
        height: Math.abs(end - zero),
      }),
    );
    marks.push(
      h(
        "text",
        {
          class: VALUE_CLASS,
          x: center,
          y: row.value >= 0 ? end - 6 : end + 14,
          "text-anchor": "middle",
        },
        formatNumber(lang, row.value),
      ),
    );
  });

  return { width, height, marks };
}

/**
 * `::bar-chart{from="sales" category="name" value="total" direction="vertical" title="Sales"}` draws
 * one value per category from a collection or a list in `_data`, as fixed SVG written at build time:
 * no script, no fetch, and no computation on the reader's device. Bars grow from zero, the axis ticks
 * are chosen from the data range, and each value is written at its bar's end. A row with no value keeps
 * its place as a gap and says "No value" in the table under the chart, which is the text alternative
 * and always shows the whole category label. Colours come from the chart tokens, so light and dark
 * follow the theme and no status or callout colour is borrowed.
 */
export default function barChart({ props, site, page }: ComponentProps<BarChartProps>) {
  const from = text(props.from);
  if (from === "") return h("p", { class: MISSING_CLASS, role: "note" }, NO_SOURCE_TEXT);

  const category = text(props.category) || "id";
  const valueField = text(props.value) || "value";
  const rows = rowsOf(site, from, category, valueField);
  if (rows === undefined || rows.length === 0) {
    return h("p", { class: MISSING_CLASS, role: "note" }, `${DEFAULT_TITLE}: no rows in "${from}".`);
  }

  const direction = directionOf(props.direction);
  const title = text(props.title);
  const name = title === "" ? `${DEFAULT_TITLE}: ${from}` : title;
  const base = idBase(props.id, from);
  const titleId = `${base}-title`;
  const lang = page.lang;
  const rtl = page.dir === "rtl";
  const values = rows.flatMap((row) => (row.value === undefined ? [] : [row.value]));
  const ticks = ticksOf(Math.min(...values), Math.max(...values));
  const chart =
    direction === "vertical" ? verticalChart(rows, ticks, lang, rtl) : horizontalChart(rows, ticks, lang, rtl);
  const description = `Values of ${valueField} by ${category}, ${rows.length} ${rows.length === 1 ? "row" : "rows"}.`;

  return h(
    "figure",
    { class: `${CLASS} ${CLASS}-${direction}`, id: base, "data-bar-chart": from },
    title === "" ? null : h("figcaption", { class: TITLE_CLASS }, title),
    h(
      "svg",
      {
        class: SVG_CLASS,
        viewBox: `0 0 ${chart.width} ${chart.height}`,
        role: "img",
        "aria-labelledby": titleId,
        preserveAspectRatio: "xMidYMid meet",
      },
      h("title", { id: titleId }, name),
      ...chart.marks,
    ),
    chartData({
      title: name,
      description,
      labelHeading: CATEGORY_HEADING,
      columns: [VALUE_HEADING],
      rows: rows.map((row) => ({ id: row.id, label: row.label, values: [row.value] })),
      lang,
      id: base,
    }),
  );
}
