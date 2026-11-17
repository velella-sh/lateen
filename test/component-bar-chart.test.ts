import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { ComponentProps } from "@velella/mizzen/contracts";
import { renderToString } from "preact-render-to-string";
import barChart, {
  BAR_CLASS,
  CLASS,
  MAX_VERTICAL_LABEL_LENGTH,
  MISSING_CLASS,
  NO_VALUE_CLASS,
  NO_VALUE_TEXT,
  TABLE_CLASS,
  directive,
  directionOf,
  idBase,
  lookup,
  numericValue,
  rowsOf,
  shortenLabel,
  ticksOf,
  type BarChartProps,
} from "../components/bar-chart/index.ts";

type Site = ComponentProps<BarChartProps>["site"];

function render(props: BarChartProps, site: unknown, lang = "en"): string {
  const input = { props, page: { lang }, site, html: "" } as unknown as ComponentProps<BarChartProps>;
  return renderToString(barChart(input) as never);
}

const css = readFileSync(new URL("../components/bar-chart/style.css", import.meta.url), "utf8");

const SALES = {
  data: {
    sales: [
      { id: "alpha", name: "Alpha", total: 30 },
      { id: "beta", name: "Beta", total: null },
      { id: "gamma", name: "Gamma", total: 0 },
    ],
  },
};

const REGIONS = {
  collections: {
    regions: {
      name: "regions",
      source: "regions.json",
      records: [
        { id: "north", fields: { name: "North", total: "12" } },
        { id: "south", fields: { name: "South", total: "4" } },
      ],
    },
  },
};

function bars(html: string): number {
  return (html.match(new RegExp(`class="${BAR_CLASS}"`, "g")) ?? []).length;
}

test("default export is the bar-chart component and it answers the bar-chart directive", () => {
  assert.equal(typeof barChart, "function");
  assert.equal(directive, "bar-chart");
});

test("lookup reads dotted and slashed paths, and never inherited keys", () => {
  const data = { sales: { q1: { total: 3 } } };
  assert.deepEqual(lookup(data, "sales.q1.total"), 3);
  assert.deepEqual(lookup(data, "sales/q1/total"), 3);
  assert.equal(lookup(data, "sales.q2"), undefined);
  assert.equal(lookup({}, "toString"), undefined);
});

test("rowsOf reads a data list and a collection, keeping ids and whole labels", () => {
  const fromData = rowsOf({ ...SALES, collections: {} } as unknown as Site, "sales", "name", "total");
  assert.deepEqual(fromData, [
    { id: "alpha", label: "Alpha", value: 30 },
    { id: "beta", label: "Beta", value: undefined },
    { id: "gamma", label: "Gamma", value: 0 },
  ]);

  const fromCollection = rowsOf(
    { data: {}, collections: REGIONS.collections } as unknown as Site,
    "regions",
    "name",
    "total",
  );
  assert.deepEqual(fromCollection, [
    { id: "north", label: "North", value: 12 },
    { id: "south", label: "South", value: 4 },
  ]);

  assert.equal(rowsOf({ data: {}, collections: {} } as unknown as Site, "missing", "name", "total"), undefined);
});

test("an empty cell, a null, and a word all mean no value; a numeric string is a value", () => {
  assert.equal(numericValue(4), 4);
  assert.equal(numericValue("4.5"), 4.5);
  for (const raw of [null, undefined, "", " ", "many", true, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(numericValue(raw), undefined, String(raw));
  }
});

test("ticks are a readable round set that includes zero and the range", () => {
  assert.deepEqual(ticksOf(0, 40), [0, 10, 20, 30, 40]);
  const negative = ticksOf(-5, 10);
  assert.equal(negative[0], -5);
  assert.ok(negative[negative.length - 1]! >= 10);

  const single = ticksOf(7, 7);
  assert.equal(single[0], 0);
  assert.equal(single[single.length - 1], 7);
  assert.ok(single.includes(7));

  const flat = ticksOf(0, 0);
  assert.equal(flat[0], 0);
  assert.equal(flat[flat.length - 1], 1);
});

test("a single bar still gets a scale from zero to its value", () => {
  const html = render({ from: "sales", category: "name", value: "total", title: "Sales" }, {
    data: { sales: [{ id: "only", name: "Only", total: 7 }] },
  });
  assert.equal(bars(html), 1);
  assert.match(html, /class="bar-chart-value"[^>]*>7</);
  assert.match(html, /class="bar-chart-tick"[^>]*>0</);
  assert.match(html, /class="bar-chart-tick"[^>]*>7</);
  assert.match(html, /<caption>Sales<\/caption>/);
});

test("a horizontal chart draws bars, writes values at their ends, and leaves a gap for a missing value", () => {
  const html = render({ from: "sales", category: "name", value: "total", title: "Sales" }, SALES);
  assert.match(html, new RegExp(`<figure class="${CLASS} ${CLASS}-horizontal"`));
  assert.match(html, /role="img"/);
  assert.match(html, /aria-labelledby="bar-chart-sales-title"/);
  assert.equal(bars(html), 2);
  assert.match(html, /class="bar-chart-value"[^>]*>30</);
  assert.match(html, /class="bar-chart-value"[^>]*>0</);
  assert.match(html, /class="bar-chart-tick"[^>]*>10</);
  assert.match(html, /class="bar-chart-no-value"[^>]*>No value</);
  assert.match(html, new RegExp(`<td class="${NO_VALUE_CLASS}">${NO_VALUE_TEXT}</td>`));
  assert.doesNotMatch(html, /<script/);
});

test("a vertical chart draws the same rows as bars along the block axis", () => {
  const html = render(
    { from: "regions", category: "name", value: "total", direction: "vertical", title: "Regions" },
    REGIONS,
  );
  assert.match(html, new RegExp(`<figure class="${CLASS} ${CLASS}-vertical"`));
  assert.equal(bars(html), 2);
  assert.match(html, /class="bar-chart-label"[^>]*>North</);
  assert.match(html, /class="bar-chart-label"[^>]*>South</);
  assert.match(html, /class="bar-chart-value"[^>]*>12</);
  assert.match(html, /aria-labelledby="bar-chart-regions-title"/);
});

test("a vertical chart leaves a gap and says so in the table for a missing value", () => {
  const html = render(
    { from: "sales", category: "name", value: "total", direction: "vertical" },
    { data: { sales: [{ id: "a", name: "A", total: 3 }, { id: "b", name: "B", total: null }] } },
  );
  assert.equal(bars(html), 1);
  assert.match(html, /class="bar-chart-no-value"[^>]*>No value</);
  assert.match(html, new RegExp(`<td class="${NO_VALUE_CLASS}">${NO_VALUE_TEXT}</td>`));
});

test("a very long category label is cut in the SVG, kept whole in the table and in a title", () => {
  const long = "A category label that is far too long for the axis";
  const short = shortenLabel(long, MAX_VERTICAL_LABEL_LENGTH);
  assert.equal(Array.from(short).length, MAX_VERTICAL_LABEL_LENGTH);
  assert.ok(short.endsWith("…"));

  const html = render(
    { from: "sales", category: "name", value: "total", direction: "vertical" },
    { data: { sales: [{ id: "a", name: long, total: 5 }] } },
  );
  assert.match(html, new RegExp(`<title>${long}</title>`));
  assert.ok(html.includes(short));
  assert.ok(html.includes(long));
});

test("a missing source and an empty source show a note instead of an empty frame", () => {
  const missing = render({ from: "unknown", category: "name", value: "total" }, { data: {}, collections: {} });
  assert.match(missing, new RegExp(`class="${MISSING_CLASS}"`));
  assert.ok(missing.includes("unknown"));

  const empty = render({ from: "sales", category: "name", value: "total" }, { data: { sales: [] }, collections: {} });
  assert.match(empty, new RegExp(`class="${MISSING_CLASS}"`));

  const unnamed = render({}, { data: {} });
  assert.match(unnamed, new RegExp(`class="${MISSING_CLASS}"`));
});

test("the direction and the id are read from the directive, with a safe fallback", () => {
  assert.equal(directionOf("vertical"), "vertical");
  assert.equal(directionOf(" Vertical "), "vertical");
  assert.equal(directionOf("sideways"), "horizontal");
  assert.equal(directionOf(undefined), "horizontal");
  assert.equal(idBase("My chart", "sales"), "my-chart");
  assert.equal(idBase(undefined, "sales"), "bar-chart-sales");
  assert.equal(idBase(undefined, ""), "bar-chart");
});

test("the table under the chart is the text alternative and keeps every row", () => {
  const html = render({ from: "sales", category: "name", value: "total", title: "Sales" }, SALES);
  assert.match(html, new RegExp(`<table class="${TABLE_CLASS}">`));
  assert.match(html, /<th scope="col">Category<\/th>/);
  assert.match(html, /<th scope="col">Value<\/th>/);
  for (const label of ["Alpha", "Beta", "Gamma"]) {
    assert.match(html, new RegExp(`<th scope="row">${label}</th>`));
  }
});

test("the styles use the chart colour token and no status, state, or callout colour", () => {
  assert.match(css, /fill: var\(--chart-cat-1\)/);
  assert.doesNotMatch(css, /var\(--(?:status|state|callout)/);
  assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}\b/);
});
