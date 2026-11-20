import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { ComponentProps } from "@velella/mizzen/contracts";
import { renderToString } from "preact-render-to-string";
import { NO_VALUE_TEXT } from "../components/bar-chart/index.ts";
import stackedBar, {
  CATEGORY_HEADING,
  CLASS,
  LEGEND_CLASS,
  LEGEND_TEXT,
  LIMIT_CLASS,
  LIMIT_TEXT,
  MAX_SERIES,
  NO_VALUE_CLASS,
  SEGMENT_CLASS,
  SEGMENT_VALUE_CLASS,
  rowsOfStacked,
  seriesOf,
  type StackedBarProps,
} from "../components/stacked-bar/index.ts";

type Site = ComponentProps<StackedBarProps>["site"];

function render(props: StackedBarProps, site: unknown, lang = "en"): string {
  const input = { props, page: { lang }, site, html: "" } as unknown as ComponentProps<StackedBarProps>;
  return renderToString(stackedBar(input) as never);
}

const css = "" /* lateen-legacy removed: components/stacked-bar/style.css */;

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

const TITLE = "Revenue by quarter";
const PROPS: StackedBarProps = {
  from: "revenue",
  category: "quarter",
  series: "region",
  value: "total",
  title: TITLE,
};

function drawnSegments(html: string): number {
  return (html.match(new RegExp(`class="${SEGMENT_CLASS} `, "g")) ?? []).length;
}

function legend(html: string): Array<{ colour: number; label: string }> {
  return [...html.matchAll(/class="stacked-bar-swatch stacked-bar-series-(\d+)"[^>]*><\/span>([^<]+)<\/li>/g)].map(
    (match) => ({ colour: Number(match[1]), label: match[2] ?? "" }),
  );
}

test("rowsOfStacked groups the source's rows into one bar per category", () => {
  const rows = rowsOfStacked({ data: REVENUE.data, collections: {} } as unknown as Site, "revenue", "quarter", "region", "total");
  assert.deepEqual(
    rows?.map((row) => ({ label: row.label, segments: row.segments })),
    [
      {
        label: "Q1",
        segments: [
          { series: "North", value: 30 },
          { series: "South", value: 12 },
          { series: "East", value: 8 },
        ],
      },
      {
        label: "Q2",
        segments: [
          { series: "North", value: 20 },
          { series: "South", value: undefined },
          { series: "East", value: 5 },
        ],
      },
      {
        label: "Q3",
        segments: [
          { series: "North", value: 15 },
          { series: "South", value: 9 },
          { series: "East", value: 0 },
        ],
      },
    ],
  );
  assert.equal(
    rowsOfStacked({ data: {}, collections: {} } as unknown as Site, "missing", "quarter", "region", "total"),
    undefined,
  );
});

test("seriesOf keeps the order the series first appear, which the legend and the table reuse", () => {
  const rows = rowsOfStacked({ data: REVENUE.data, collections: {} } as unknown as Site, "revenue", "quarter", "region", "total");
  assert.deepEqual(seriesOf(rows ?? []), ["North", "South", "East"]);
});

test("three categories draw three bars, one segment per series, with no script", () => {
  const html = render(PROPS, REVENUE);
  assert.match(html, new RegExp(`<figure class="${CLASS}" id="stacked-bar-revenue" data-stacked-bar="revenue"`));
  assert.match(html, new RegExp(`<figcaption class="${CLASS}-title">${TITLE}</figcaption>`));
  assert.equal((html.match(/class="stacked-bar-label"/g) ?? []).length, 3, "one category label per bar");
  assert.equal(drawnSegments(html), 7, "two empty segments are not drawn");
  assert.match(html, /class="stacked-bar-axis"/);
  assert.match(html, /class="stacked-bar-tick"[^>]*>50</, "the axis ends at the Q1 total of the raw values");
  assert.doesNotMatch(html, /%/, "segments keep their values and are never normalised");
});

test("a segment value is text inside the segment only when it fits, and is in the table always", () => {
  const html = render(PROPS, REVENUE);
  for (const value of ["30", "12", "8", "20", "5", "15", "9"]) {
    assert.match(html, new RegExp(`class="${SEGMENT_VALUE_CLASS}"[^>]*>${value}<`), value);
  }

  const tiny = {
    data: {
      sales: [
        { id: "a", quarter: "Q1", region: "North", total: 1000 },
        { id: "b", quarter: "Q1", region: "South", total: 2 },
      ],
    },
  };
  const narrow = render({ ...PROPS, from: "sales" }, tiny);
  assert.match(narrow, new RegExp(`class="${SEGMENT_VALUE_CLASS}"[^>]*>1,000<`));
  assert.doesNotMatch(narrow, new RegExp(`class="${SEGMENT_VALUE_CLASS}"[^>]*>2<`), "2px is too narrow for its digit");
  assert.match(narrow, /<td>2<\/td>/, "the table keeps the value the bar cannot show");
});

test("an empty segment stays out of its bar and says so in the table", () => {
  const html = render(PROPS, REVENUE);
  assert.equal(drawnSegments(html), 7);
  assert.match(html, new RegExp(`<td class="${NO_VALUE_CLASS}">${NO_VALUE_TEXT}</td>`));
  assert.match(html, /<th scope="row">Q3<\/th><td>15<\/td><td>9<\/td><td>0<\/td>/, "a zero segment stays in the data");

  const gaps = {
    data: {
      sales: [
        { id: "a", quarter: "Q1", region: "North", total: null },
        { id: "b", quarter: "Q1", region: "South", total: "" },
      ],
    },
  };
  const empty = render({ ...PROPS, from: "sales" }, gaps);
  assert.equal(drawnSegments(empty), 0);
  assert.match(empty, new RegExp(`class="${CLASS}-no-value"[^>]*>${NO_VALUE_TEXT}<`));
  assert.equal((empty.match(new RegExp(`<td class="${NO_VALUE_CLASS}"`, "g")) ?? []).length, 2);
});

test("the legend lists every series in source order with one categorical colour each", () => {
  const html = render(PROPS, REVENUE);
  assert.match(html, new RegExp(`<ul class="${LEGEND_CLASS}" aria-label="${LEGEND_TEXT}">`));
  assert.deepEqual(legend(html), [
    { colour: 1, label: "North" },
    { colour: 2, label: "South" },
    { colour: 3, label: "East" },
  ]);
});

test("the table is the text alternative, with a column per series and every segment value", () => {
  const html = render(PROPS, REVENUE);
  assert.match(html, new RegExp(`<th scope="col">${CATEGORY_HEADING}</th><th scope="col">North</th><th scope="col">South</th><th scope="col">East</th>`));
  assert.match(html, /<th scope="row">Q1<\/th><td>30<\/td><td>12<\/td><td>8<\/td>/);
  assert.match(html, /<th scope="row">Q2<\/th><td>20<\/td><td class="stacked-bar-no-value">No value<\/td><td>5<\/td>/);
});

test("a source with more series than the chart can colour shows a note instead of a crowded chart", () => {
  const many = {
    data: {
      sales: Array.from({ length: MAX_SERIES + 1 }, (_, index) => ({
        id: `s${index}`,
        quarter: "Q1",
        region: `Series ${index + 1}`,
        total: 1,
      })),
    },
  };
  const html = render({ ...PROPS, from: "sales" }, many);
  assert.match(html, new RegExp(`class="${LIMIT_CLASS}"`));
  assert.ok(html.includes(LIMIT_TEXT));
  assert.doesNotMatch(html, new RegExp(`<svg class="${CLASS}-svg"`));
});
