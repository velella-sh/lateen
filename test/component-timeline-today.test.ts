import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToString } from "preact-render-to-string";
import { JSDOM } from "jsdom";
import type { ComponentProps, Page, Site } from "@velella/mizzen/contracts";
import timeline from "../components/timeline/index.ts";
import { enhance, LINE_CLASS, SAMPLE_CLASS, todayPosition } from "../components/timeline/client.ts";

const site = {
  config: {
    base: "",
    theme: { options: { status: { values: { done: { tone: "positive" }, late: { tone: "negative" } } } } },
  },
  nav: {},
  data: {},
  pages: [],
  collections: {},
} as unknown as Site;

function render(lang = "en"): string {
  const page = { lang, url: "/events/", frontMatter: {} } as unknown as Page;
  const input = {
    props: {
      items: JSON.stringify([
        {
          label: "One",
          start: "2026-01-01",
          end: "2026-01-11",
          status: "done",
          phases: [{ label: "Build", start: "2026-01-01", end: "2026-01-06", status: "done" }],
        },
        { label: "Two", start: "2026-01-12", end: "2026-01-21", status: "late" },
      ]),
    },
    page,
    site,
    html: "",
  } as unknown as ComponentProps;
  return renderToString(timeline(input) as never);
}

const at = (day: string) => Date.parse(`${day}T12:00:00Z`);

test("a day inside the axis lands at its share of the span", () => {
  assert.equal(todayPosition("2026-01-01", "2026-01-11", at("2026-01-06")), 50);
  assert.equal(todayPosition("2026-01-01", "2026-01-11", at("2026-01-01")), 0);
});

test("a day before the axis, on its end, or after it has no place", () => {
  assert.equal(todayPosition("2026-01-01", "2026-01-11", at("2025-12-31")), undefined);
  assert.equal(todayPosition("2026-01-01", "2026-01-11", at("2026-01-11")), undefined);
  assert.equal(todayPosition("2026-01-01", "2026-01-11", at("2026-02-01")), undefined);
  assert.equal(todayPosition("not a date", "2026-01-11", at("2026-01-06")), undefined);
});

test("the built page carries no date of its own", () => {
  const out = render();
  assert.doesNotMatch(out, /class="[^"]*\btimeline-today\b/);
  assert.doesNotMatch(out, /timeline-today-label/);
});

test("the island draws the line on the axis and in every track, and names it in the legend", () => {
  const dom = new JSDOM(render());
  enhance(dom.window.document as never, at("2026-01-06"));

  const lines = dom.window.document.querySelectorAll(`.${LINE_CLASS}`);
  assert.equal(lines.length, 3, "the axis and both rows");
  assert.match(lines[0]!.getAttribute("style") ?? "", /inset-inline-start:\d+(?:\.\d+)?%/);
  const label = lines[0]!.querySelector(".timeline-today-label");
  assert.equal(label?.textContent, "Today");
  assert.ok(dom.window.document.querySelector(`.${SAMPLE_CLASS}`), "the legend gains the line's key");
  assert.match(dom.window.document.querySelector(".timeline-legend")?.textContent ?? "", /Today/);
});

test("a timeline whose axis is before the reader's day is left as the build wrote it", () => {
  const dom = new JSDOM(render());
  enhance(dom.window.document as never, at("2027-01-06"));
  assert.equal(dom.window.document.querySelectorAll(`.${LINE_CLASS}`).length, 0);
  assert.equal(dom.window.document.querySelector(`.${SAMPLE_CLASS}`), null);
});

test("the label follows the page language", () => {
  const dom = new JSDOM(render("fa"));
  enhance(dom.window.document as never, at("2026-01-06"));
  assert.equal(dom.window.document.querySelector(".timeline-today-label")?.textContent, "امروز");
});
