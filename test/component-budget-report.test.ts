import assert from "node:assert/strict";
import { test } from "node:test";
import type { ComponentProps } from "@velella/mizzen/contracts";
import budgetReport, { targetsOf } from "../components/budget-report/index.ts";
import { pageIn, render, rows, siteWith, text } from "./report-test-helpers.ts";

const REPORT = {
  tool: "lateen/performance-report",
  version: 1,
  commit: "de29199",
  tolerance: 64,
  routes: [
    {
      route: "/",
      classes: [
        { name: "css/base", raw: 1000, gzip: 300, count: 1, budget: { gzip: 310, count: 1 } },
        { name: "js/chrome", raw: 2000, gzip: 700, count: 2, budget: { gzip: 600, count: 2 } },
      ],
    },
    { route: "/guide/", classes: [{ name: "js/inline", raw: 500, gzip: 200, count: 1 }] },
  ],
  totals: [
    { route: "/", javascript: { raw: 2000, gzip: 700 }, css: { raw: 1000, gzip: 300 } },
    { route: "/guide/", javascript: { raw: 500, gzip: 200 }, css: { raw: 0, gzip: 0 } },
  ],
};

function renderReport(props: Record<string, string>, data: Readonly<Record<string, unknown>> = { "performance-report": REPORT }, lang = "en") {
  return render(
    budgetReport({
      props,
      site: siteWith(data),
      page: pageIn(lang),
      html: "",
    } as unknown as ComponentProps<Record<string, string>>),
  );
}

test("a missing report is a visible note", () => {
  const doc = renderReport({}, {});
  assert.equal(doc.querySelector(".report-missing")?.getAttribute("role"), "note");
  assert.match(text(doc), /no performance-report report/);
});

test("every route and asset class keeps its measured bytes, its budget, and whether it is over", () => {
  const doc = renderReport({});
  const classes = rows(doc);
  assert.deepEqual(classes[0]?.slice(0, 7), ["/", "css/base", "1", "1,000 B", "300 B", "310 B (1)", "within the budget"]);
  assert.deepEqual(classes[1]?.slice(0, 7), ["/", "js/chrome", "2", "2,000 B", "700 B", "600 B (2)", "over the budget"]);
  assert.deepEqual(classes[2]?.slice(0, 7), ["/guide/", "js/inline", "1", "500 B", "200 B", "No budget", ""]);
  assert.equal(doc.querySelectorAll(".budget-report-bar").length, 2, "a class with no budget gets no bar");
});

test("a bar is the measured share of the budget, capped at 100 percent", () => {
  const doc = renderReport({});
  const fills = [...doc.querySelectorAll(".budget-report-bar-fill")].map((fill) => fill.getAttribute("style"));
  assert.deepEqual(fills, ["inline-size:97%", "inline-size:100%"]);
});

test("targets mark a route inside or outside them in words, not by colour alone", () => {
  const inside = renderReport({ targets: '{"js":650,"css":512}' });
  assert.match(text(inside), /inside the targets/);
  assert.match(text(inside), /outside the targets: JavaScript/);

  const none = renderReport({});
  assert.match(text(none), /No target given/);
});

test("targets are read from a JSON object or a compact list, and an unreadable value sets none", () => {
  assert.deepEqual(targetsOf('{"js":100,"css":50}'), { js: 100, css: 50 });
  assert.deepEqual(targetsOf("js=100, css=50"), { js: 100, css: 50 });
  assert.deepEqual(targetsOf("js=-1,css=nope"), {});
  assert.deepEqual(targetsOf("{"), {});
  assert.deepEqual(targetsOf(undefined), {});
});

test("bytes are shown in the page language's digits", () => {
  const persian = renderReport({}, undefined, "fa");
  assert.match(text(persian), /[۰-۹]/, "Persian digits appear");
  assert.match(text(persian), /گزارش کارایی/);
  // Intl's Arabic default is Latin digits; the number still follows the page language's formatting.
  const arabic = renderReport({}, undefined, "ar");
  assert.match(text(arabic), /700 B/);
  assert.match(text(arabic), /تقرير الأداء/);
});

test("the commit links to the repository's commit page", () => {
  const doc = renderReport({});
  assert.equal(doc.querySelector(".budget-report-commit a")?.getAttribute("href"), "https://github.com/velella-sh/lateen/commit/de29199");
});
