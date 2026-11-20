import assert from "node:assert/strict";
import { test } from "node:test";
import type { ComponentProps } from "@velella/mizzen/contracts";
import { renderToString } from "preact-render-to-string";
import barChart, { ticksOf as barTicksOf, type BarChartProps } from "../components/bar-chart/index.ts";
import stackedBar, { type StackedBarProps } from "../components/stacked-bar/index.ts";
import lineChart, { type LineChartProps } from "../components/line-chart/index.ts";
import { scale } from "../components/timeline/scale.ts";
import {
  domainOf,
  evenTicksOf,
  extentOf,
  paddedDomain,
  percentOf,
  percentScaleOf,
  ratioOf,
  stackedTotalsOf,
  ticksOf,
  xScaleOf,
  yScaleOf,
} from "../components/chart-data/scale.ts";

test("the bar chart's ticks are the shared tick calculation", () => {
  assert.equal(barTicksOf, ticksOf);
});

test("ticksOf covers zero range, a single value, negatives, and decimals", () => {
  assert.deepEqual(ticksOf(0, 0), [0, 0.2, 0.4, 0.6, 0.8, 1]);
  const single = ticksOf(7, 7);
  assert.equal(single[0], 0);
  assert.ok(single.includes(7));
  const negative = ticksOf(-5, 10);
  assert.equal(negative[0], -5);
  assert.ok(negative[negative.length - 1]! >= 10);
  assert.ok(negative.includes(0));
  const decimal = ticksOf(0, 0.4);
  assert.equal(decimal[0], 0);
  assert.ok(decimal[decimal.length - 1]! >= 0.4);
  assert.deepEqual(ticksOf(Number.NaN, Number.POSITIVE_INFINITY), [0, 0.2, 0.4, 0.6, 0.8, 1]);
});

test("domainOf includes zero and reads a non-finite end as zero", () => {
  assert.deepEqual(domainOf(3, 10), { low: 0, high: 10 });
  assert.deepEqual(domainOf(-10, -3), { low: -10, high: 0 });
  assert.deepEqual(domainOf(Number.NaN, Number.POSITIVE_INFINITY), { low: 0, high: 0 });
});

test("extentOf reads the ends of the values, and undefined when there are none", () => {
  assert.equal(extentOf([]), undefined);
  assert.deepEqual(extentOf([3, -2, 7.5, 0]), { low: -2, high: 7.5 });
  assert.deepEqual(extentOf([5]), { low: 5, high: 5 });
});

test("paddedDomain gives a single value room and leaves a real range alone", () => {
  assert.deepEqual(paddedDomain(5, 5), { low: 4, high: 6 });
  assert.deepEqual(paddedDomain(-3, -3), { low: -4, high: -2 });
  assert.deepEqual(paddedDomain(2, 9), { low: 2, high: 9 });
});

test("evenTicksOf spans the domain with rounded, evenly spaced ticks", () => {
  assert.deepEqual(evenTicksOf(4, 6), [4, 4.5, 5, 5.5, 6]);
  assert.deepEqual(evenTicksOf(0, 10, 3), [0, 5, 10]);
  const ticks = evenTicksOf(-1, 1);
  assert.equal(ticks[0], -1);
  assert.equal(ticks[ticks.length - 1], 1);
});

test("ratioOf and percentOf place a value in its domain, and a span of zero reads as zero", () => {
  assert.equal(ratioOf(5, 0, 10), 0.5);
  assert.equal(ratioOf(0, 0, 10), 0);
  assert.equal(ratioOf(10, 0, 10), 1);
  assert.equal(ratioOf(7, 7, 7), 0);
  assert.equal(percentOf(5, 0, 10), 50);
  assert.equal(percentOf(0, 0, 10), 0);
  assert.equal(percentOf(10, 0, 10), 100);
  assert.equal(percentOf(3, 0, 12), (3 / 12) * 100);
});

test("the axis mappers place the domain's ends at the plot's edges, mirrored or not", () => {
  const x = xScaleOf(0, 10, 100, 400);
  assert.equal(x(0), 100);
  assert.equal(x(10), 500);
  assert.equal(x(5), 300);
  const mirrored = xScaleOf(0, 10, 100, 400, true);
  assert.equal(mirrored(0), 500);
  assert.equal(mirrored(10), 100);
  assert.equal(mirrored(5), 300);
  const y = yScaleOf(0, 10, 20, 200);
  assert.equal(y(0), 220);
  assert.equal(y(10), 20);
  const px = percentScaleOf(50, 600);
  assert.equal(px(0), 50);
  assert.equal(px(100), 650);
  const pxMirrored = percentScaleOf(650, 600, true);
  assert.equal(pxMirrored(0), 650);
  assert.equal(pxMirrored(100), 50);
});

test("stackedTotalsOf adds each sign separately and a missing value adds nothing", () => {
  assert.deepEqual(stackedTotalsOf([{ value: 30 }, { value: undefined }, { value: 0 }, { value: -5 }]), {
    positive: 30,
    negative: -5,
  });
  assert.deepEqual(stackedTotalsOf([]), { positive: 0, negative: 0 });
});

function xs(html: string, className: string): number[] {
  return [...html.matchAll(new RegExp(`class="${className}" x1="([^"]+)"`, "g"))].map((match) => Number(match[1]));
}

test("a bar chart and a stacked chart with the same totals draw the same scale", () => {
  const rows = [
    { id: "a", name: "A", quarter: "Q1", region: "North", total: 30 },
    { id: "b", name: "B", quarter: "Q2", region: "North", total: 12 },
    { id: "c", name: "C", quarter: "Q3", region: "North", total: 8 },
  ];
  const site = { data: { sales: rows }, collections: {} };
  const barInput = { props: { from: "sales", category: "name", value: "total" }, page: { lang: "en" }, site, html: "" } as unknown as ComponentProps<BarChartProps>;
  const stackedInput = { props: { from: "sales", category: "quarter", series: "region", value: "total" }, page: { lang: "en" }, site, html: "" } as unknown as ComponentProps<StackedBarProps>;
  const bar = renderToString(barChart(barInput) as never);
  const stacked = renderToString(stackedBar(stackedInput) as never);
  assert.deepEqual(xs(bar, "bar-chart-grid"), xs(stacked, "stacked-bar-grid"));
  const grid = xs(bar, "bar-chart-grid");
  assert.deepEqual(ticksOf(0, 30), [0, 5, 10, 15, 20, 25, 30]);
  assert.equal(grid.length, 7);
  assert.equal(grid[0], 188);
  assert.equal(grid[grid.length - 1], 648);
});

test("a single numeric value sits mid-axis, and a flat series still gets a padded scale", () => {
  const single = {
    props: { from: "one", category: "month", value: "total" },
    page: { lang: "en" },
    site: { data: { one: [{ id: "a", month: 3, total: 7 }] }, collections: {} },
    html: "",
  } as unknown as ComponentProps<LineChartProps>;
  const html = renderToString(lineChart(single) as never);
  assert.match(html, /class="line-chart-point[^"]*" cx="334"/, "the point sits at 50% of the plot");

  const flat = {
    props: { from: "flat", category: "month", value: "total" },
    page: { lang: "en" },
    site: { data: { flat: [{ id: "a", month: 1, total: 5 }, { id: "b", month: 2, total: 5 }] }, collections: {} },
    html: "",
  } as unknown as ComponentProps<LineChartProps>;
  const flatHtml = renderToString(lineChart(flat) as never);
  assert.match(flatHtml, /class="line-chart-tick"[^>]*>4</);
  assert.match(flatHtml, /class="line-chart-tick"[^>]*>6</);
});

test("the timeline scale places a single day by the shared percentage, with a length of its own", () => {
  const axis = scale([{ start: "2020-02-10", end: "2020-02-10" }]);
  assert.ok(axis !== undefined);
  const from = Date.parse(axis.from);
  const to = Date.parse(axis.to);
  const day = Date.parse("2020-02-10");
  const segment = axis.segments[0];
  assert.ok(segment !== undefined);
  assert.equal(segment.start, percentOf(day, from, to));
  assert.ok(segment.length > 0, "a one-day row still has a length");
  assert.deepEqual(axis.ticks.map((tick) => tick.position), axis.ticks.map((tick) => percentOf(Date.parse(tick.date), from, to)));
});