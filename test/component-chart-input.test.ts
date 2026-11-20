import assert from "node:assert/strict";
import { test } from "node:test";
import type { ComponentProps } from "@velella/mizzen/contracts";
import { renderToString } from "preact-render-to-string";
import barChart, {
  idBase as barIdBase,
  lookup as barLookup,
  numericValue as barNumericValue,
  shortenLabel as barShortenLabel,
  type BarChartProps,
} from "../components/bar-chart/index.ts";
import stackedBar, { MAX_SERIES, idBase as stackedIdBase, type StackedBarProps } from "../components/stacked-bar/index.ts";
import lineChart, { idBase as lineIdBase, type LineChartProps } from "../components/line-chart/index.ts";
import chartData, { NO_VALUE_CLASS, NO_VALUE_TEXT, type ChartDataProps } from "../components/chart-data/index.ts";
import {
  MAX_SERIES as SHARED_MAX_SERIES,
  chartRows,
  fieldOf,
  idBaseOf,
  isJson,
  labelDir,
  labelOf,
  lookup,
  numericValue,
  seriesColour,
  shortenLabel,
  slugOf,
  text,
} from "../components/chart-data/input.ts";

test("the charts read through the one shared validation module", () => {
  assert.equal(barNumericValue, numericValue);
  assert.equal(barLookup, lookup);
  assert.equal(MAX_SERIES, SHARED_MAX_SERIES);
});

test("numericValue keeps zero, negatives, and decimals, and rejects everything without a finite number", () => {
  assert.equal(numericValue(0), 0);
  assert.equal(numericValue(-5), -5);
  assert.equal(numericValue(4.5), 4.5);
  assert.equal(numericValue("4.5"), 4.5);
  assert.equal(numericValue(" -0.25 "), -0.25);
  assert.equal(numericValue("1e3"), 1000);
  for (const raw of [null, undefined, "", " ", "many", true, {}, [], Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, "NaN", "Infinity"]) {
    assert.equal(numericValue(raw), undefined, String(raw));
  }
});

test("text and isJson bound what a row may be", () => {
  assert.equal(text("  from "), "from");
  assert.equal(text(7), "");
  assert.equal(text(undefined), "");
  assert.ok(isJson({ a: 1 }));
  for (const raw of [null, undefined, [], "x", 3]) assert.ok(!isJson(raw), String(raw));
});

test("lookup and fieldOf resolve own keys only, and never inherited ones", () => {
  const data = { sales: { q1: { total: 3 } } };
  assert.equal(lookup(data, "sales.q1.total"), 3);
  assert.equal(lookup(data, "sales/q1/total"), 3);
  assert.equal(lookup(data, "sales.q2"), undefined);
  assert.equal(lookup({}, "toString"), undefined);
  assert.equal(fieldOf({ a: { b: 2 } }, "a.b"), 2);
  assert.equal(fieldOf({ a: { b: 2 } }, "a/b"), undefined, "a field path uses dots only");
  assert.equal(fieldOf({}, "constructor"), undefined);
});

test("labelOf keeps a string or number label and falls back to the id for anything missing", () => {
  assert.equal(labelOf("Alpha", "row-1"), "Alpha");
  assert.equal(labelOf(7, "row-1"), "7");
  assert.equal(labelOf(0, "row-1"), "0");
  for (const raw of ["", null, undefined, true, {}, []]) assert.equal(labelOf(raw, "row-1"), "row-1", String(raw));
});

test("shortenLabel cuts by code point at the limit and keeps shorter labels whole", () => {
  assert.equal(shortenLabel("abc", 3), "abc");
  assert.equal(shortenLabel("abcd", 3), "ab…");
  assert.equal(shortenLabel("ab😀cd", 4), "ab😀…", "cuts by code point, never splitting a surrogate pair");
  assert.equal(barShortenLabel("abcd"), "abcd", "the bar chart keeps its own default limit");
});

test("labelDir isolates Latin text on an RTL page only", () => {
  assert.equal(labelDir("North", true), "ltr");
  assert.equal(labelDir("North", false), undefined);
  assert.equal(labelDir("شمال", true), undefined);
  assert.equal(labelDir("צפון", true), undefined);
  assert.equal(labelDir("North شمال", true), undefined);
  assert.equal(labelDir("123", true), undefined);
});

test("idBaseOf gives every chart the same id rules, including a malformed id prop", () => {
  for (const [idBase, prefix] of [[barIdBase, "bar-chart"], [stackedIdBase, "stacked-bar"], [lineIdBase, "line-chart"]] as const) {
    assert.equal(idBase("My chart", "sales"), "my-chart");
    assert.equal(idBase(undefined, "sales"), `${prefix}-sales`);
    assert.equal(idBase(undefined, ""), prefix);
    // A prop that slugs to nothing falls back to the source, the same in every chart.
    assert.equal(idBase("!!!", "sales"), `${prefix}-sales`);
    assert.equal(idBase("!!!", "!!!"), prefix);
    assert.equal(idBaseOf("  ", "a.b", prefix), `${prefix}-a-b`);
  }
  assert.equal(slugOf("  Sales Q1! "), "sales-q1");
});

test("seriesColour cycles the categorical tokens, and the stacked limit is the shared one", () => {
  assert.deepEqual(Array.from({ length: 10 }, (_, index) => seriesColour(index)), [1, 2, 3, 4, 5, 6, 7, 8, 1, 2]);
  assert.equal(MAX_SERIES, 8);
});

test("chartRows keeps only labelled rows with a finite value, from numbers or numeric strings", () => {
  assert.deepEqual(
    chartRows([
      { label: " Core UI ", value: 12 },
      { label: "Docs UI", value: "18" },
      { label: "Zero", value: 0 },
      { label: "Negative", value: -2.5 },
      { label: "", value: 3 },
      { label: "Missing" },
      { label: "Word", value: "many" },
      { label: "Empty", value: "" },
      { label: "NaN", value: Number.NaN },
      { label: "Bool", value: true },
      null,
      [1, 2],
      "row",
    ]),
    [
      { label: "Core UI", value: 12 },
      { label: "Docs UI", value: 18 },
      { label: "Zero", value: 0 },
      { label: "Negative", value: -2.5 },
    ],
  );
  for (const raw of [undefined, null, {}, "[]", 3]) assert.deepEqual(chartRows(raw), [], String(raw));
});

test("a non-finite number in the data table reads as a missing value, not as NaN", () => {
  const props: ChartDataProps = {
    title: "Budgets",
    description: "Transfer budgets.",
    labelHeading: "Asset",
    columns: ["Budget"],
    rows: [
      { id: "a", label: "A", values: [Number.NaN] },
      { id: "b", label: "B", values: [Number.POSITIVE_INFINITY] },
      { id: "c", label: "C", values: [12] },
    ],
    lang: "en",
  };
  const html = renderToString(chartData(props) as never);
  assert.equal((html.match(new RegExp(`<td class="${NO_VALUE_CLASS}">${NO_VALUE_TEXT}</td>`, "g")) ?? []).length, 2);
  assert.match(html, /<td>12<\/td>/);
  assert.doesNotMatch(html, /NaN|Infinity/);
});

function render(component: (input: never) => unknown, props: Readonly<Record<string, unknown>>, rows: unknown[], fields: Record<string, string>): string {
  const input = {
    props: { from: "sales", ...fields, ...props },
    page: { lang: "en" },
    site: { data: { sales: rows }, collections: {} },
    html: "",
  } as unknown as ComponentProps<BarChartProps>;
  return renderToString(component(input as never) as never);
}

test("bar, stacked-bar, and line charts read the same malformed rows the same way", () => {
  const rows = [
    { id: "a", name: "A", quarter: "Q1", region: "North", month: 1, total: "6" },
    { id: "b", name: "", quarter: "Q1", region: "South", month: 2, total: "many" },
    { id: "c", name: "C", quarter: "Q2", region: "North", month: 3, total: "" },
  ];
  const bar = render(barChart, {}, rows, { category: "name", value: "total" });
  const stacked = render(stackedBar as never, {}, rows, { category: "quarter", series: "region", value: "total" });
  const line = render(lineChart as never, {}, rows, { category: "month", value: "total" });

  // The numeric string is a value in all three; the word and the empty cell are not.
  assert.match(bar, /class="bar-chart-value"[^>]*>6</);
  assert.match(bar, /class="bar-chart-no-value"[^>]*>No value</);
  assert.match(stacked, /class="stacked-bar-segment-value"[^>]*>6</);
  assert.match(stacked, /class="stacked-bar-no-value"[^>]*>No value</);
  assert.match(line, /<td>6<\/td>/);
  assert.match(line, /class="line-chart-no-value"[^>]*>No value</);
  // The empty label falls back to the row id in the bar chart's table.
  assert.match(bar, /<th scope="row">b<\/th>/);
});

test("a line chart with a malformed id prop names itself after its source, like the other charts", () => {
  const input = {
    props: { from: "growth", category: "month", value: "total", id: "!!!" },
    page: { lang: "en" },
    site: { data: { growth: [{ id: "a", month: 1, total: 3 }] }, collections: {} },
    html: "",
  } as unknown as ComponentProps<LineChartProps>;
  const html = renderToString(lineChart(input) as never);
  assert.match(html, /id="line-chart-growth"/);
  assert.match(html, /aria-labelledby="line-chart-growth-title"/);
});