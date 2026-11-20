import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { ComponentProps } from "@velella/mizzen/contracts";
import { renderToString } from "preact-render-to-string";
import barChart from "../components/bar-chart/index.ts";
import {
  DEFAULT_SUMMARY,
  DETAILS_CLASS,
  NO_VALUE_CLASS,
  NO_VALUE_TEXT,
  SUMMARY_CLASS,
  TABLE_CLASS,
} from "../components/chart-data/index.ts";
import charts from "../components/charts/index.ts";
import lineChart from "../components/line-chart/index.ts";
import performanceChart from "../components/performance-chart/index.ts";
import stackedBar from "../components/stacked-bar/index.ts";

type Chart = { props: Record<string, unknown>; site?: unknown };

const SALES = {
  data: {
    sales: [
      { id: "alpha", name: "Alpha", total: 30 },
      { id: "beta", name: "Beta", total: null },
      { id: "gamma", name: "Gamma", total: 0 },
      { id: "delta", name: "Delta", total: -5 },
    ],
  },
};

const GROWTH = {
  data: {
    growth: [
      { id: "1", month: 1, north: 10, south: 4 },
      { id: "2", month: 2, north: 14, south: 8 },
      { id: "3", month: 3, north: null, south: 6 },
      { id: "4", month: 4, north: 18, south: 9 },
    ],
  },
};

const REVENUE = {
  data: {
    revenue: [
      { id: "q1-north", quarter: "Q1", region: "North", total: 30 },
      { id: "q1-south", quarter: "Q1", region: "South", total: 12 },
      { id: "q1-east", quarter: "Q1", region: "East", total: 8 },
      { id: "q2-north", quarter: "Q2", region: "North", total: 20 },
      { id: "q2-south", quarter: "Q2", region: "South", total: null },
      { id: "q2-east", quarter: "Q2", region: "East", total: 5 },
      { id: "q3-north", quarter: "Q3", region: "North", total: 15 },
      { id: "q3-south", quarter: "Q3", region: "South", total: 9 },
      { id: "q3-east", quarter: "Q3", region: "East", total: 0 },
    ],
  },
};

function render(component: (input: never) => unknown, chart: Chart): string {
  const input = {
    props: chart.props,
    page: { lang: "en" },
    site: chart.site ?? { data: {}, collections: {} },
    html: "",
  } as unknown as never;
  return renderToString(component(input) as never);
}

const BAR = render(barChart as never, {
  props: { from: "sales", category: "name", value: "total", title: "Sales" },
  site: SALES,
});

const LINE = render(lineChart as never, {
  props: { from: "growth", category: "month", value: "north,south", title: "Growth" },
  site: GROWTH,
});

const STACKED = render(stackedBar as never, {
  props: { from: "revenue", category: "quarter", series: "region", value: "total", title: "Revenue" },
  site: REVENUE,
});

const ISLAND = render(charts as never, {
  props: {
    title: "Users by quarter",
    rows: JSON.stringify([
      { label: "Q1", value: 1200 },
      { label: "Q2", value: 0 },
    ]),
  },
});

const PERFORMANCE = render(performanceChart as never, { props: {} });

const OUTPUTS: Record<string, string> = {
  bar: BAR,
  line: LINE,
  stacked: STACKED,
  island: ISLAND,
  performance: PERFORMANCE,
};

/** The CSV the chart's own download link carries, decoded from its data URI. */
function csvOf(html: string): string {
  const href = html.match(/href="(data:text\/csv[^"]*)"/)?.[1];
  assert.ok(href, "the chart offers a CSV download");
  return decodeURIComponent(href.split(",", 2)[1] ?? "");
}

/** The row labels of the table, in document order. */
function rowLabels(html: string): string[] {
  return [...html.matchAll(/<th scope="row">([^<]*)<\/th>/g)].map((match) => match[1] ?? "");
}

test("every chart variant puts its table, summary, and downloads on the one chart-data path", () => {
  for (const [name, html] of Object.entries(OUTPUTS)) {
    assert.match(html, new RegExp(`<details class="${DETAILS_CLASS}">`), `${name} details`);
    assert.doesNotMatch(html, /<details[^>]*\sopen/, `${name} table stays closed`);
    assert.match(html, new RegExp(`<summary class="${SUMMARY_CLASS}">${DEFAULT_SUMMARY}</summary>`), `${name} summary`);
    assert.equal((html.match(new RegExp(`<table class="${TABLE_CLASS}">`, "g")) ?? []).length, 1, `${name} one table`);
    assert.match(html, /<nav class="chart-data-downloads" aria-label="Download the chart data">/, `${name} downloads`);
  }
});

test("headers and units stay intact, including a unit only stated in the heading", () => {
  assert.match(BAR, /<th scope="col">Category<\/th><th scope="col">Value<\/th>/);
  assert.match(LINE, /<th scope="col">Category<\/th><th scope="col">north<\/th><th scope="col">south<\/th>/);
  assert.match(
    STACKED,
    /<th scope="col">Category<\/th><th scope="col">North<\/th><th scope="col">South<\/th><th scope="col">East<\/th>/,
  );
  assert.match(ISLAND, /<th scope="col">Label<\/th><th scope="col">Value<\/th>/);
  assert.match(PERFORMANCE, /<th scope="col">Asset<\/th><th scope="col">Budget \(KB\)<\/th>/);
  assert.match(csvOf(PERFORMANCE), /^Asset,Budget \(KB\)\n/);
});

test("zero, negative, and missing values survive in the same order as the source", () => {
  assert.deepEqual(rowLabels(BAR), ["Alpha", "Beta", "Gamma", "Delta"]);
  assert.match(BAR, /<td>30<\/td>/);
  assert.match(BAR, new RegExp(`<td class="${NO_VALUE_CLASS}">${NO_VALUE_TEXT}</td>`));
  assert.match(BAR, /<td>0<\/td>/);
  assert.match(BAR, /<td>-5<\/td>/);
  assert.equal(
    csvOf(BAR),
    "Category,Value\nAlpha,30\nBeta,\nGamma,0\nDelta,-5\n",
  );

  assert.deepEqual(rowLabels(LINE), ["1", "2", "3", "4"]);
  assert.equal(csvOf(LINE), "Category,north,south\n1,10,4\n2,14,8\n3,,6\n4,18,9\n");

  assert.deepEqual(rowLabels(STACKED), ["Q1", "Q2", "Q3"]);
  assert.match(STACKED, /<th scope="row">Q3<\/th><td>15<\/td><td>9<\/td><td>0<\/td>/);
  assert.equal(
    csvOf(STACKED),
    "Category,North,South,East\nQ1,30,12,8\nQ2,20,,5\nQ3,15,9,0\n",
  );

  assert.deepEqual(rowLabels(ISLAND), ["Q1", "Q2"]);
  assert.equal(csvOf(ISLAND), "Label,Value\nQ1,1200\nQ2,0\n");

  assert.deepEqual(rowLabels(PERFORMANCE), ["Core UI", "Docs UI", "Lazy chart"]);
  assert.equal(csvOf(PERFORMANCE), "Asset,Budget (KB)\nCore UI,12\nDocs UI,18\nLazy chart,75\n");
});

test("the download name comes from the same id as the chart, and print opens the table", () => {
  assert.match(BAR, /download="bar-chart-sales\.csv"/);
  assert.match(LINE, /download="line-chart-growth\.csv"/);
  assert.match(STACKED, /download="stacked-bar-revenue\.csv"/);
  assert.match(ISLAND, /download="charts-users-by-quarter\.csv"/);
  assert.match(PERFORMANCE, /download="performance-chart\.csv"/);

  const printCss = readFileSync(new URL("../styles/print.css", import.meta.url), "utf8");
  assert.match(printCss, /details:not\(\[open\]\)\s*>\s*:not\(summary\)\s*\{[^}]*display:\s*block\s*!important/);
});
