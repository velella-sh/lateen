import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { ComponentProps } from "@velella/mizzen/contracts";
import { renderToString } from "preact-render-to-string";
import barChart, {
  BAR_CLASS,
  CLASS,
  MAX_VERTICAL_LABEL_LENGTH,
  NO_VALUE_CLASS,
  NO_VALUE_TEXT,
  directionOf,
  rowsOf,
  shortenLabel,
  type BarChartProps,
} from "../components/bar-chart/index.ts";
import { NO_VALUE_CLASS as DATA_NO_VALUE_CLASS, NO_VALUE_TEXT as DATA_NO_VALUE_TEXT } from "../components/chart-data/index.ts";

type Site = ComponentProps<BarChartProps>["site"];

function render(props: BarChartProps, site: unknown, lang = "en"): string {
  const input = { props, page: { lang }, site, html: "" } as unknown as ComponentProps<BarChartProps>;
  return renderToString(barChart(input) as never);
}

const css = "" /* lateen-legacy removed: components/bar-chart/style.css */;

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

test("a single bar still gets a scale from zero to its value", () => {
  const html = render({ from: "sales", category: "name", value: "total", title: "Sales" }, {
    data: { sales: [{ id: "only", name: "Only", total: 7 }] },
  });
  assert.equal(bars(html), 1);
  assert.match(html, /class="bar-chart-value"[^>]*>7</);
  assert.match(html, /class="bar-chart-tick"[^>]*>0</);
  assert.match(html, /class="bar-chart-tick"[^>]*>7</);
});

test("a horizontal chart draws bars, writes values at their ends, and leaves a gap for a missing value", () => {
  const html = render({ from: "sales", category: "name", value: "total", title: "Sales" }, SALES);
  assert.match(html, new RegExp(`<figure class="${CLASS} ${CLASS}-horizontal"`));
  assert.equal(bars(html), 2);
  assert.match(html, /class="bar-chart-value"[^>]*>30</);
  assert.match(html, /class="bar-chart-value"[^>]*>0</);
  assert.match(html, /class="bar-chart-tick"[^>]*>10</);
  assert.match(html, /class="bar-chart-no-value"[^>]*>No value</);
  assert.match(html, new RegExp(`<td class="${DATA_NO_VALUE_CLASS}">${DATA_NO_VALUE_TEXT}</td>`));
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
});

test("a vertical chart leaves a gap and says so in the table for a missing value", () => {
  const html = render(
    { from: "sales", category: "name", value: "total", direction: "vertical" },
    { data: { sales: [{ id: "a", name: "A", total: 3 }, { id: "b", name: "B", total: null }] } },
  );
  assert.equal(bars(html), 1);
  assert.match(html, /class="bar-chart-no-value"[^>]*>No value</);
  assert.match(html, new RegExp(`<td class="${DATA_NO_VALUE_CLASS}">${DATA_NO_VALUE_TEXT}</td>`));
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

test("the direction is read from the directive, with a safe fallback", () => {
  assert.equal(directionOf("vertical"), "vertical");
  assert.equal(directionOf(" Vertical "), "vertical");
  assert.equal(directionOf("sideways"), "horizontal");
  assert.equal(directionOf(undefined), "horizontal");
});
