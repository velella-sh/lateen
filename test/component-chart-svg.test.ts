import assert from "node:assert/strict";
import { test } from "node:test";
import type { ComponentProps } from "@velella/mizzen/contracts";
import { renderToString } from "preact-render-to-string";
import barChart, { type BarChartProps } from "../components/bar-chart/index.ts";
import stackedBar, { type StackedBarProps } from "../components/stacked-bar/index.ts";
import lineChart, { type LineChartProps } from "../components/line-chart/index.ts";
import { barMark, labelMark, lineMark, svgFrame, textMark } from "../components/chart-data/svg.ts";

const render = (node: unknown): string => renderToString(node as never);

test("lineMark and barMark render the axis, grid, and bar marks in the charts' attribute order", () => {
  assert.equal(render(lineMark("grid", 1, 2, 3, 4)), '<line class="grid" x1="1" x2="2" y1="3" y2="4"></line>');
  assert.equal(render(barMark("bar", 1, 2, 3, 4)), '<rect class="bar" x="1" y="2" width="3" height="4"></rect>');
});

test("textMark anchors text and leaves an unset anchor or direction off the mark", () => {
  assert.equal(render(textMark("tick", 1, 2, "middle", "7")), '<text class="tick" x="1" y="2" text-anchor="middle">7</text>');
  assert.equal(render(textMark("no-value", 1, 2, undefined, "No value")), '<text class="no-value" x="1" y="2">No value</text>');
  assert.equal(render(textMark("tick", 1, 2, "end", "x", "ltr")), '<text class="tick" x="1" y="2" text-anchor="end" dir="ltr">x</text>');
});

test("labelMark keeps the whole label in a title only when the cut removed anything", () => {
  assert.equal(
    render(labelMark("label", 1, 2, "end", "Whole label", "Whole…")),
    '<text class="label" x="1" y="2" text-anchor="end"><title>Whole label</title>Whole…</text>',
  );
  assert.equal(
    render(labelMark("label", 1, 2, "end", "Same", "Same")),
    '<text class="label" x="1" y="2" text-anchor="end">Same</text>',
  );
});

test("svgFrame names the chart and draws its marks in order", () => {
  assert.equal(
    render(svgFrame("chart-svg", 720, 260, "chart-title", "Sales", [lineMark("grid", 0, 1, 0, 1)])),
    '<svg class="chart-svg" viewBox="0 0 720 260" role="img" aria-labelledby="chart-title" preserveAspectRatio="xMidYMid meet">' +
      '<title id="chart-title">Sales</title><line class="grid" x1="0" x2="1" y1="0" y2="1"></line></svg>',
  );
});

const ROWS = [
  { id: "a", name: "A", quarter: "Q1", region: "North", month: 1, total: 30 },
  { id: "b", name: "B", quarter: "Q2", region: "North", month: 2, total: 12 },
];
const SITE = { data: { sales: ROWS }, collections: {} };

test("every chart frames its SVG the same way: an img named by its title", () => {
  const bar = render(barChart({ props: { from: "sales", category: "name", value: "total", title: "Sales" }, page: { lang: "en" }, site: SITE, html: "" } as unknown as ComponentProps<BarChartProps>));
  const stacked = render(stackedBar({ props: { from: "sales", category: "quarter", series: "region", value: "total", title: "Sales" }, page: { lang: "en" }, site: SITE, html: "" } as unknown as ComponentProps<StackedBarProps>));
  const line = render(lineChart({ props: { from: "sales", category: "month", value: "total", title: "Sales" }, page: { lang: "en" }, site: SITE, html: "" } as unknown as ComponentProps<LineChartProps>));
  for (const [html, id] of [[bar, "bar-chart-sales"], [stacked, "stacked-bar-sales"], [line, "line-chart-sales"]] as const) {
    assert.match(html, new RegExp(`<svg class="[a-z-]+" viewBox="0 0 \\d+ \\d+" role="img" aria-labelledby="${id}-title" preserveAspectRatio="xMidYMid meet"><title id="${id}-title">Sales</title>`));
  }
});

test("a long category label keeps the shared title-and-cut mark in the bar and stacked charts", () => {
  const long = "A category label that is far too long for the axis";
  const site = { data: { sales: [{ id: "a", name: long, quarter: long, region: "North", total: 5 }] }, collections: {} };
  const bar = render(barChart({ props: { from: "sales", category: "name", value: "total" }, page: { lang: "en" }, site, html: "" } as unknown as ComponentProps<BarChartProps>));
  const stacked = render(stackedBar({ props: { from: "sales", category: "quarter", series: "region", value: "total" }, page: { lang: "en" }, site, html: "" } as unknown as ComponentProps<StackedBarProps>));
  for (const html of [bar, stacked]) {
    assert.match(html, new RegExp(`<text class="[a-z-]+-label"[^>]*><title>${long}</title>`));
  }
});