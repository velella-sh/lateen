import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToString } from "preact-render-to-string";
import type { ComponentProps } from "@velella/mizzen/contracts";
import barChart, { BAR_CLASS, LABEL_CLASS, type BarChartProps } from "../components/bar-chart/index.ts";
import lineChart, { END_LABEL_CLASS, TICK_CLASS, type LineChartProps } from "../components/line-chart/index.ts";

const SALES = {
  data: {
    sales: [
      { id: "alpha", name: "Alpha", total: 30 },
      { id: "beta", name: "Beta", total: 10 },
    ],
  },
};

const GROWTH = {
  data: {
    growth: [
      { id: "1", month: 1, north: 10 },
      { id: "2", month: 2, north: 14 },
      { id: "3", month: 3, north: 18 },
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

function renderBar(props: BarChartProps, lang = "en", dir = "ltr"): string {
  const input = { props, page: { lang, dir }, site: SALES, html: "" } as unknown as ComponentProps<BarChartProps>;
  return renderToString(barChart(input) as never);
}

function renderLine(props: LineChartProps, site: unknown, lang = "en", dir = "ltr"): string {
  const input = { props, page: { lang, dir }, site, html: "" } as unknown as ComponentProps<LineChartProps>;
  return renderToString(lineChart(input) as never);
}

/** The `x` of every element with `className`, in document order. */
function xs(html: string, className: string): number[] {
  return [...html.matchAll(new RegExp(`class="${className}[^"]*"[^>]*\\sx="([^"]+)"`, "g"))].map((match) => Number(match[1]));
}

/** The `x` and `width` of every bar, in document order. */
function bars(html: string): Array<{ x: number; width: number }> {
  return [...html.matchAll(/class="bar-chart-bar[^"]*"[^>]*x="([^"]+)"[^>]*width="([^"]+)"/g)].map((match) => ({
    x: Number(match[1]),
    width: Number(match[2]),
  }));
}

test("a horizontal bar chart starts from the reading side of a right-to-left page", () => {
  const ltr = bars(renderBar({ from: "sales", category: "name", value: "total" }));
  const rtl = bars(renderBar({ from: "sales", category: "name", value: "total" }, "fa", "rtl"));
  assert.ok(ltr[0]!.width > ltr[1]!.width, "the taller bar is longer in English");
  assert.ok(ltr[0]!.x + ltr[0]!.width > ltr[1]!.x + ltr[1]!.width, "and reaches further right");
  assert.ok(rtl[0]!.x < rtl[1]!.x, "the taller bar starts further left in Persian");
  assert.ok(rtl[0]!.width > rtl[1]!.width, "and is still longer");
});

test("a Latin label states its own direction on a right-to-left page, and numbers use its digits", () => {
  const out = renderBar({ from: "sales", category: "name", value: "total" }, "fa", "rtl");
  assert.match(out, new RegExp(`class="${LABEL_CLASS}"[^>]*dir="ltr"`));
  assert.doesNotMatch(renderBar({ from: "sales", category: "name", value: "total" }), /dir="ltr"/);
  assert.match(out, /۳۰/, "the value reads in Persian digits");
});

test("a numeric line chart is mirrored, and its Latin series labels keep their direction", () => {
  const ltr = renderLine({ from: "growth", category: "month", value: "north" }, GROWTH);
  const rtl = renderLine({ from: "growth", category: "month", value: "north" }, GROWTH, "fa", "rtl");
  const ltrTicks = xs(ltr, TICK_CLASS).filter((x) => x > 40);
  const rtlTicks = xs(rtl, TICK_CLASS).filter((x) => x > 40);
  assert.ok(ltrTicks[0]! < ltrTicks[ltrTicks.length - 1]!, "the axis grows right in English");
  assert.ok(rtlTicks[0]! > rtlTicks[rtlTicks.length - 1]!, "the axis grows left in Persian");
  assert.match(rtl, new RegExp(`class="${END_LABEL_CLASS}[^"]*"[^>]*dir="ltr"`));
  assert.match(rtl, /text-anchor="end"/);
});

test("a time axis is never mirrored, and its ticks follow the page's calendar and digits", () => {
  const out = renderLine({ from: "traffic", category: "date", value: "visits" }, TRAFFIC, "fa", "rtl");
  const ticks = xs(out, TICK_CLASS).filter((x) => x > 40);
  assert.ok(ticks[0]! < ticks[ticks.length - 1]!, "time still runs left to right");
  assert.match(out, /۱۳۹[۸۹]|۱۴۰[۰-۹]/, "a Persian year, in Persian digits");
});

test("an Arabic page reads its own digits and keeps a Latin series label isolated", () => {
  const out = renderLine({ from: "growth", category: "month", value: "north" }, GROWTH, "ar", "rtl");
  assert.match(out, /[\u0660-\u0669]/, "Arabic-Indic digits");
  assert.match(out, new RegExp(`class="${END_LABEL_CLASS}[^"]*"[^>]*dir="ltr"`));
});
