import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { ComponentProps } from "@velella/mizzen/contracts";
import { renderToString } from "preact-render-to-string";
import lineChart, {
  CLASS,
  LINE_CLASS,
  MISSING_CLASS,
  NO_VALUE_CLASS,
  NO_VALUE_TEXT,
  POINT_CLASS,
  rowsOf,
  seriesOf,
  viewOf,
  type LineChartProps,
} from "../components/line-chart/index.ts";

type Site = ComponentProps<LineChartProps>["site"];

function render(props: LineChartProps, site: unknown, lang = "en"): string {
  const input = { props, page: { lang }, site, html: "" } as unknown as ComponentProps<LineChartProps>;
  return renderToString(lineChart(input) as never);
}

const css = "" /* lateen-legacy removed: components/line-chart/style.css */;

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

const TRAFFIC = {
  data: {
    traffic: [
      { id: "a", date: "2020-02-10", visits: 5 },
      { id: "b", date: "2020-05-20", visits: 9 },
    ],
  },
};

function count(html: string, className: string): number {
  return (html.match(new RegExp(`class="${className}\\b`, "g")) ?? []).length;
}

/** The whole `<path>` for a series, then its `d` attribute. */
function pathOf(html: string, field: string): string {
  const tag = html.match(new RegExp(`<path [^>]*data-series="${field}"[^>]*>`));
  assert.ok(tag, `path for ${field}`);
  return tag![0].match(/ d="([^"]*)"/)?.[1] ?? "";
}

test("rowsOf reads a data list and a collection, giving every row an id", () => {
  assert.deepEqual(rowsOf({ ...GROWTH, collections: {} } as unknown as Site, "growth"), GROWTH.data.growth);
  assert.deepEqual(rowsOf({ data: { growth: [{ north: 1 }] }, collections: {} } as unknown as Site, "growth"), [
    { north: 1, id: "1" },
  ]);
  assert.deepEqual(
    rowsOf(
      {
        data: {},
        collections: {
          growth: {
            name: "growth",
            source: "growth.json",
            records: [{ id: "north", fields: { month: 1, north: 3 } }],
          },
        },
      } as unknown as Site,
      "growth",
    ),
    [{ month: 1, north: 3, id: "north" }],
  );
  assert.equal(rowsOf({ data: {}, collections: {} } as unknown as Site, "missing"), undefined);
});

test("seriesOf reads a comma separated list and defaults to the value field", () => {
  assert.deepEqual(seriesOf("north, south"), ["north", "south"]);
  assert.deepEqual(seriesOf("north"), ["north"]);
  assert.deepEqual(seriesOf(""), ["value"]);
  assert.deepEqual(seriesOf(" , "), ["value"]);
});

test("the view model reads each category and series value once per row", () => {
  const reads = new Map<string, number>();
  const counted = (fields: Record<string, number | null>) => {
    const row: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fields)) {
      Object.defineProperty(row, key, {
        enumerable: true,
        get: () => {
          reads.set(key, (reads.get(key) ?? 0) + 1);
          return value;
        },
      });
    }
    return row;
  };
  const rows = [
    counted({ month: 1, north: 10, south: 4 }),
    counted({ month: 2, north: 14, south: 8 }),
    counted({ month: 3, north: null, south: 6 }),
  ];

  const view = viewOf(rows, "month", ["north", "south"], "en");

  assert.ok(view);
  assert.equal(view.rows.length, 3);
  assert.deepEqual(view.rows.map((row) => row.values), [[10, 4], [14, 8], [undefined, 6]]);
  // One read per field per row, however many series the chart draws.
  assert.deepEqual(Object.fromEntries(reads), { month: 3, north: 3, south: 3 });
});


test("two series draw two lines, their points, and a direct label at each end", () => {
  const html = render({ from: "growth", category: "month", value: "north,south", title: "Growth" }, GROWTH);
  assert.match(html, new RegExp(`<figure class="${CLASS}" id="line-chart-growth"`));
  assert.equal(count(html, LINE_CLASS), 2);
  assert.equal(count(html, POINT_CLASS), 7);
  assert.match(html, /class="line-chart-end-label line-chart-series-1"[^>]*>north</);
  assert.match(html, /class="line-chart-end-label line-chart-series-2"[^>]*>south</);
});

test("a missing value breaks the line instead of joining across it", () => {
  const html = render({ from: "growth", category: "month", value: "north,south" }, GROWTH);
  // North has a hole at month 3: two subpaths. South is complete: one.
  assert.equal(pathOf(html, "north").match(/M/g)?.length, 2);
  assert.equal(pathOf(html, "south").match(/M/g)?.length, 1);
  assert.equal(count(html, POINT_CLASS), 7);
  assert.match(html, new RegExp(`<td class="${NO_VALUE_CLASS}">${NO_VALUE_TEXT}</td>`));
});

test("a date axis uses the timeline scale, its quarters and its ticks", () => {
  const html = render({ from: "traffic", category: "date", value: "visits", title: "Traffic" }, TRAFFIC);
  assert.match(html, /class="line-chart-tick"[^>]*>2020 Q1</);
  assert.match(html, /class="line-chart-tick"[^>]*>2020 Q2</);
  assert.equal(count(html, LINE_CLASS), 1);
  assert.equal(count(html, POINT_CLASS), 2);
  assert.match(html, /<th scope="row">2020-02-10<\/th>/);
});

test("a date axis labels each tick by its quarter in the page's calendar", () => {
  // 2020-01-01 falls in the third month of Hijri year 1441, so its quarter is Q2 of that calendar, not Q1.
  const html = render({ from: "traffic", category: "date", value: "visits", title: "Traffic" }, TRAFFIC, "ar");
  assert.match(html, /class="line-chart-tick"[^>]*>١٤٤١ هـ Q٢</);
  assert.match(html, /class="line-chart-tick"[^>]*>١٤٤١ هـ Q٣</);
});

test("a single point is still drawn and labelled", () => {
  const html = render(
    { from: "one", category: "date", value: "total", title: "One" },
    { data: { one: [{ id: "a", date: "2021-06-01", total: 7 }] } },
  );
  assert.equal(count(html, POINT_CLASS), 1);
  assert.equal(pathOf(html, "total").match(/M/g)?.length, 1);
  assert.equal(pathOf(html, "total").match(/L/g), null);
  assert.match(html, /class="line-chart-end-label line-chart-series-1"[^>]*>total</);
  assert.match(html, /class="line-chart-tick"[^>]*>7</);
});

test("a line chart whose category is a word shows a note instead of an empty frame", () => {
  const words = render(
    { from: "growth", category: "month", value: "north" },
    { data: { growth: [{ id: "a", month: "one", north: 3 }] } },
  );
  assert.match(words, new RegExp(`class="${MISSING_CLASS}"`));
});

test("collection lines keep public nested values while omitting the private series", () => {
  const site = {
    config: { collections: { growth: { public: ["month", "totals.public"] } } },
    collections: { growth: { records: [{ id: "north", fields: {
      month: 1, totals: { public: 3, private: 938471 },
    } }] } },
  };
  const html = render({ from: "growth", category: "month", value: "totals.public, totals.private" }, site);
  assert.equal(count(html, POINT_CLASS), 1);
  assert.doesNotMatch(html, /938471/);
});
