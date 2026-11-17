import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { ComponentProps } from "@velella/mizzen/contracts";
import { renderToString } from "preact-render-to-string";
import barChart, { type BarChartProps } from "../components/bar-chart/index.ts";
import chartData, {
  BODY_CLASS,
  DEFAULT_SUMMARY,
  DESCRIPTION_CLASS,
  DETAILS_CLASS,
  NO_VALUE_CLASS,
  NO_VALUE_TEXT,
  SUMMARY_CLASS,
  TABLE_CLASS,
  type ChartDataProps,
} from "../components/chart-data/index.ts";
import { formatNumber } from "../src/report.ts";

function render(overrides: Partial<ChartDataProps> = {}): string {
  const props: ChartDataProps = {
    title: "Users by quarter",
    description: "Users in each quarter of the year.",
    labelHeading: "Category",
    columns: ["Users"],
    rows: [
      { id: "q1", label: "Q1", values: [1200] },
      { id: "q2", label: "Q2", values: [0] },
      { id: "q3", label: "Q3", values: [-5] },
      { id: "q4", label: "Q4", values: [undefined] },
    ],
    lang: "en",
    ...overrides,
  };
  return renderToString(chartData(props) as never);
}

const css = readFileSync(new URL("../components/chart-data/style.css", import.meta.url), "utf8");
const printCss = readFileSync(new URL("../styles/print.css", import.meta.url), "utf8");

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

function renderChart(props: BarChartProps): string {
  const input = {
    props,
    page: { lang: "en" },
    site: { ...SALES, collections: {} },
    html: "",
  } as unknown as ComponentProps<BarChartProps>;
  return renderToString(barChart(input) as never);
}

test("default export is the chart-data component", () => {
  assert.equal(typeof chartData, "function");
});

test("the table sits in a closed details with a clear summary, a title, and a description", () => {
  const html = render();
  assert.match(html, new RegExp(`<details class="${DETAILS_CLASS}">`));
  assert.doesNotMatch(html, /<details[^>]*\sopen/);
  assert.match(html, new RegExp(`<summary class="${SUMMARY_CLASS}">${DEFAULT_SUMMARY}</summary>`));
  assert.match(html, new RegExp(`<p class="${DESCRIPTION_CLASS}">Users in each quarter of the year\\.</p>`));
  assert.match(html, /<caption>Users by quarter<\/caption>/);
  assert.match(html, new RegExp(`<div class="${BODY_CLASS}">`));
});

test("every value the chart plots is in the table, including zero, a negative, and a missing value", () => {
  const html = render();
  for (const label of ["Q1", "Q2", "Q3", "Q4"]) {
    assert.match(html, new RegExp(`<th scope="row">${label}</th>`));
  }
  assert.match(html, /<td>1,200<\/td>/);
  assert.match(html, /<td>0<\/td>/);
  assert.match(html, /<td>-5<\/td>/);
  assert.match(html, new RegExp(`<td class="${NO_VALUE_CLASS}">${NO_VALUE_TEXT}</td>`));
});

test("numbers are formatted in the page's language", () => {
  const expected = formatNumber("fa", 1200);
  const html = render({ lang: "fa" });
  assert.ok(html.includes(`<td>${expected}</td>`), expected);
});

test("a custom summary is used, and a blank one falls back to the default", () => {
  assert.match(render({ summary: "Numbers behind the chart" }), />Numbers behind the chart<\/summary>/);
  assert.match(render({ summary: "   " }), new RegExp(`>${DEFAULT_SUMMARY}</summary>`));
});

test("the bar chart puts every plotted value in the chart-data table under it", () => {
  const html = renderChart({ from: "sales", category: "name", value: "total", title: "Sales" });
  assert.match(html, new RegExp(`<details class="${DETAILS_CLASS}">`));
  assert.match(html, new RegExp(`<p class="${DESCRIPTION_CLASS}">Values of total by name, 4 rows\\.</p>`));

  const plotted = [...html.matchAll(/class="bar-chart-value"[^>]*>([^<]+)</g)].map((match) => match[1]);
  assert.deepEqual(plotted, ["30", "0", "-5"]);
  for (const value of plotted) {
    assert.ok(html.includes(`<td>${value}</td>`), `table is missing ${value}`);
  }
  assert.match(html, new RegExp(`<td class="${NO_VALUE_CLASS}">${NO_VALUE_TEXT}</td>`));
  for (const label of ["Alpha", "Beta", "Gamma", "Delta"]) {
    assert.match(html, new RegExp(`<th scope="row">${label}</th>`));
  }
});

test("print opens the closed table, using the print stylesheet", () => {
  assert.match(printCss, /details:not\(\[open\]\)\s*>\s*:not\(summary\)\s*\{[^}]*display:\s*block\s*!important/);
  assert.doesNotMatch(render(), /\sopen(?:=|\s|>)/);
});

test("the styles use tokens and logical properties only", () => {
  assert.match(css, /\.chart-data-table/);
  assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}\b/);
  assert.doesNotMatch(css, /\b(?:margin|padding|border)-(?:left|right)\b/);
});
