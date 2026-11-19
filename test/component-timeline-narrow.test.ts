// The narrow form is a container query, not a viewport one: a timeline in a narrow panel drops the
// chart on a wide screen too. The label column stays put, the table is the labelled scroll region,
// and every row keeps its link to the record page.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { renderToString } from "preact-render-to-string";
import type { ComponentProps, DataRecord, Page, Site } from "@velella/mizzen/contracts";
import timeline from "../components/timeline/index.ts";

const read = (path: string): string => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const css = ""; // lateen-legacy removed

const record = (id: string, fields: Record<string, unknown>): DataRecord =>
  ({ id, fields, position: { line: 1, column: 1 }, fieldPositions: {} }) as unknown as DataRecord;

const events = [
  record("a", { label: "Launch", start: "2026-03-01", end: "2026-03-05", status: "done" }),
  record("b", { label: "Beta", start: "2026-04-10", end: "2026-04-20", status: "late" }),
  record("c", { label: "Draft", start: "2026-05-01", end: "2026-05-02", status: "done" }),
];

const site = {
  config: { base: "" },
  nav: {},
  data: {},
  pages: [
    { url: "/events/a/", record: { collection: "events", id: "a" } },
    { url: "/events/b/", record: { collection: "events", id: "b" } },
  ],
  collections: { events: { name: "events", source: "events.json", records: events } },
} as unknown as Site;

const page = { lang: "en", url: "/events/", frontMatter: {} } as unknown as Page;

function render(props: Record<string, unknown>): string {
  const input = { props, page, site, html: "" } as unknown as ComponentProps;
  return renderToString(timeline(input) as never);
}

test("the table is a labelled, focusable scroll region inside the query container", () => {
  const out = render({ from: "events", caption: "Roadmap" });
  assert.match(out, /^<div class="timeline">/);
  assert.match(
    out,
    /<div class="table-scroll" data-table-scroll="true" tabindex="0" role="region" aria-label="Roadmap"[^>]*>/,
  );
  assert.match(out, /<caption>Roadmap<\/caption>/);
  assert.match(out, /class="timeline-axis"/);
});

test("every row links to its page, and a row without one stays text", () => {
  const out = render({ from: "events" });
  assert.match(out, /<td class="timeline-cell" data-field="label"><a href="\/events\/a\/">Launch<\/a><\/td>/);
  assert.match(out, /<td class="timeline-cell" data-field="label"><a href="\/events\/b\/">Beta<\/a><\/td>/);
  assert.match(out, /<td class="timeline-cell" data-field="label">Draft<\/td>/);
});

test("the bars are decoration and take no tab stop", () => {
  const out = render({ from: "events", caption: "Roadmap" });
  assert.match(out, /class="timeline-bar/);
  assert.doesNotMatch(out, /class="[^"]*timeline-bar[^"]*"[^>]*tabindex/);
});

