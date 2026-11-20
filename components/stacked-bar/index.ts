import { h } from "preact";
import type { ComponentProps } from "@velella/mizzen/contracts";
import { formatNumber } from "../../src/report.ts";
import {
  NO_SOURCE_TEXT,
  NO_VALUE_TEXT,
  rowsOf,
  shortenLabel,
  ticksOf,
} from "../bar-chart/index.ts";
import { MAX_SERIES, idBaseOf, seriesColour, text } from "../chart-data/input.ts";

/** The number of series the chart colours: one per categorical token, `chart-cat-1` to `chart-cat-8`. */
export { MAX_SERIES } from "../chart-data/input.ts";

/** The Markdown directive this component handles: `::stacked-bar{from="revenue" series="region"}`. */
export const directive = "stacked-bar";

/** The directive's options; the docs page and its test read this list. */
export const OPTIONS = ["from", "category", "series", "value", "title", "id"] as const;

/** Class on the `<figure>`. `style.css` styles it. */
export const CLASS = "stacked-bar";

/** Class on the chart's title. */
export const TITLE_CLASS = "stacked-bar-title";

/** Class on the `<svg>`. */
export const SVG_CLASS = "stacked-bar-svg";

/** Class on one segment of a bar. The series colour is appended: `stacked-bar-series-1`. */
export const SEGMENT_CLASS = "stacked-bar-segment";

/** Class on the value written inside a segment when it fits. */
export const SEGMENT_VALUE_CLASS = "stacked-bar-segment-value";

/** Class on the axis line. */
export const AXIS_CLASS = "stacked-bar-axis";

/** Class on a grid line, one per tick. */
export const GRID_CLASS = "stacked-bar-grid";

/** Class on a tick label. */
export const TICK_CLASS = "stacked-bar-tick";

/** Class on a category label. */
export const LABEL_CLASS = "stacked-bar-label";

/** Class on the legend: one item per series, in the order the series first appear. */
export const LEGEND_CLASS = "stacked-bar-legend";

/** Class on the colour swatch in a legend item. */
export const SWATCH_CLASS = "stacked-bar-swatch";

/** Class on the table under the chart, the chart's text alternative. */
export const TABLE_CLASS = "stacked-bar-table";

/** Class on the gap and the table cell that stand for a segment with no value. */
export const NO_VALUE_CLASS = "stacked-bar-no-value";

/** Class on the visible note shown when the source is absent or empty. */
export const MISSING_CLASS = "stacked-bar-missing";

/** Class on the visible note shown when the source has more series than the chart draws. */
export const LIMIT_CLASS = "stacked-bar-limit";

/** The name a chart without a title takes. */
export const DEFAULT_TITLE = "Stacked bar chart";

/** The name of the legend list. */
export const LEGEND_TEXT = "Legend";

/** Category heading of the table under the chart. */
export const CATEGORY_HEADING = "Category";

/** What the chart says when it has more series than it can colour. */
export const LIMIT_TEXT = `This chart has more than ${MAX_SERIES} series.`;

export type StackedBarProps = {
  /** Collection name, or path in `_data` (dots or slashes), that holds the rows. */
  readonly from?: string;
  /** Field holding the bar's category label; defaults to `id`. Nested fields use dots. */
  readonly category?: string;
  /** Field holding the segment's series name; defaults to `series`. Nested fields use dots. */
  readonly series?: string;
  /** Field holding the segment's number; defaults to `value`. Nested fields use dots. */
  readonly value?: string;
  /** Title: the chart's accessible name and its caption. */
  readonly title?: string;
  /** Id of the figure; give one when two charts read the same source. */
  readonly id?: string;
};

/** One segment of a bar: its series and its number, when it has one. */
export interface Segment {
  readonly series: string;
  readonly value: number | undefined;
}

/** One bar of the chart: its category, its whole label, and its segments in source order. */
export interface StackedRow {
  readonly id: string;
  readonly label: string;
  readonly segments: readonly Segment[];
}

/** The id prefix of the chart: the `id` prop, or `stacked-bar` and its source path. */
export function idBase(raw: unknown, from: string): string {
  return idBaseOf(raw, from, "stacked-bar");
}

/**
 * The bars of a stacked chart, one per category, each holding its segments in source order. The two
 * reads walk the same source in the same order, so record `i` gives one category and one series name.
 */
export function rowsOfStacked(
  site: ComponentProps<StackedBarProps>["site"],
  from: string,
  category: string,
  series: string,
  value: string,
): StackedRow[] | undefined {
  const categories = rowsOf(site, from, category, value);
  const names = rowsOf(site, from, series, value);
  if (categories === undefined || names === undefined) return undefined;

  const bars = new Map<string, { id: string; label: string; segments: Segment[] }>();
  categories.forEach((row, index) => {
    const name = names[index]?.label;
    if (name === undefined) return;
    let bar = bars.get(row.label);
    if (bar === undefined) {
      bar = { id: row.id, label: row.label, segments: [] };
      bars.set(row.label, bar);
    }
    bar.segments.push({ series: name, value: row.value });
  });
  return [...bars.values()];
}

/** The series names in the order they first appear; the legend and the table columns use this order. */
export function seriesOf(rows: readonly StackedRow[]): string[] {
  const seen = new Set<string>();
  const order: string[] = [];
  for (const row of rows) {
    for (const segment of row.segments) {
      if (seen.has(segment.series)) continue;
      seen.add(segment.series);
      order.push(segment.series);
    }
  }
  return order;
}

/** The chart's size and marks: category labels at the inline start, segments stacked along the axis. */
function chartOf(rows: readonly StackedRow[], series: readonly string[], lang: string) {
  const width = 720;
  const rowHeight = 32;
  const barHeight = 20;
  const labelWidth = 168;
  const valueGutter = 72;
  const plotX = 12 + labelWidth + 8;
  const plotWidth = width - plotX - valueGutter;
  const plotTop = 12;
  const plotBottom = plotTop + rows.length * rowHeight;
  const height = plotBottom + 30;

  let low = 0;
  let high = 0;
  for (const row of rows) {
    let positive = 0;
    let negative = 0;
    for (const segment of row.segments) {
      if (segment.value === undefined) continue;
      if (segment.value > 0) positive += segment.value;
      else negative += segment.value;
    }
    high = Math.max(high, positive);
    low = Math.min(low, negative);
  }

  const ticks = ticksOf(low, high);
  const scaleLow = ticks[0] ?? 0;
  const scaleHigh = ticks[ticks.length - 1] ?? 1;
  const x = (value: number): number => plotX + ((value - scaleLow) / (scaleHigh - scaleLow || 1)) * plotWidth;
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
        { class: LABEL_CLASS, x: plotX - 8, y: center + 4, "text-anchor": "end" },
        short === row.label ? null : h("title", null, row.label),
        short,
      ),
    );

    let positive = 0;
    let negative = 0;
    let drawn = 0;
    for (const segment of row.segments) {
      if (segment.value === undefined || segment.value === 0) continue;
      const start = segment.value > 0 ? positive : negative;
      const end = start + segment.value;
      if (segment.value > 0) positive = end;
      else negative = end;
      drawn += 1;

      const startX = x(start);
      const endX = x(end);
      const left = Math.min(startX, endX);
      const span = Math.abs(endX - startX);
      const colour = seriesColour(series.indexOf(segment.series));
      marks.push(
        h("rect", {
          class: `${SEGMENT_CLASS} ${CLASS}-series-${colour}`,
          x: left,
          y: center - barHeight / 2,
          width: span,
          height: barHeight,
        }),
      );

      // An estimate: the value is drawn only when the segment is wider than its digits.
      const label = formatNumber(lang, segment.value);
      if (span >= Array.from(label).length * 7 + 8) {
        marks.push(
          h("text", { class: SEGMENT_VALUE_CLASS, x: left + span / 2, y: center + 4, "text-anchor": "middle" }, label),
        );
      }
    }
    if (drawn === 0) {
      marks.push(h("text", { class: NO_VALUE_CLASS, x: plotX + 4, y: center + 4 }, NO_VALUE_TEXT));
    }
  });

  return { width, height, marks };
}

/**
 * `::stacked-bar{from="revenue" category="quarter" series="region" value="total" title="Revenue"}`
 * draws one bar per category, with a segment per series read from the same collection or `_data` list,
 * as fixed SVG written at build time: no script, no fetch, and no computation on the reader's device.
 * Segments keep their raw values (no percentage), stack along the bar, and write their value as text
 * when the segment has room. A legend lists the series in the order they first appear, the axis ticks
 * come from the bars' totals like `bar-chart`, and the table under the chart is the text alternative
 * and always holds every segment's value. Colours come from the chart tokens, so light and dark follow
 * the theme and no status or callout colour is borrowed.
 */
export default function stackedBar({ props, site, page }: ComponentProps<StackedBarProps>) {
  const from = text(props.from);
  if (from === "") return h("p", { class: MISSING_CLASS, role: "note" }, NO_SOURCE_TEXT);

  const category = text(props.category) || "id";
  const seriesField = text(props.series) || "series";
  const valueField = text(props.value) || "value";
  const rows = rowsOfStacked(site, from, category, seriesField, valueField);
  if (rows === undefined || rows.length === 0) {
    return h("p", { class: MISSING_CLASS, role: "note" }, `${DEFAULT_TITLE}: no rows in "${from}".`);
  }

  const series = seriesOf(rows);
  if (series.length > MAX_SERIES) {
    return h("p", { class: LIMIT_CLASS, role: "note" }, LIMIT_TEXT);
  }

  const title = text(props.title);
  const name = title === "" ? `${DEFAULT_TITLE}: ${from}` : title;
  const base = idBase(props.id, from);
  const titleId = `${base}-title`;
  const lang = page.lang;
  const chart = chartOf(rows, series, lang);
  const format = (value: number) => formatNumber(lang, value);

  return h(
    "figure",
    { class: CLASS, id: base, "data-stacked-bar": from },
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
    h(
      "ul",
      { class: LEGEND_CLASS, "aria-label": LEGEND_TEXT },
      ...series.map((label, index) =>
        h(
          "li",
          { key: label },
          h("span", { class: `${SWATCH_CLASS} ${CLASS}-series-${seriesColour(index)}`, "aria-hidden": "true" }),
          label,
        ),
      ),
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
          ...series.map((label) => h("th", { scope: "col", key: label }, label)),
        ),
      ),
      h(
        "tbody",
        null,
        ...rows.map((row) =>
          h(
            "tr",
            { key: row.label },
            h("th", { scope: "row" }, row.label),
            ...series.map((label) => {
              const segment = row.segments.find((candidate) => candidate.series === label);
              return segment === undefined || segment.value === undefined
                ? h("td", { class: NO_VALUE_CLASS, key: label }, NO_VALUE_TEXT)
                : h("td", { key: label }, format(segment.value));
            }),
          ),
        ),
      ),
    ),
  );
}
