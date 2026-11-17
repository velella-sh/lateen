import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToString } from "preact-render-to-string";
import type { ComponentProps, DataRecord, Page, Site } from "@velella/mizzen/contracts";
import timeline, { ERROR_CLASS, INVALID_CLASS, MISSING_CLASS, directive } from "../components/timeline/index.ts";

const record = (id: string, fields: Record<string, unknown>): DataRecord =>
  ({ id, fields, position: { line: 1, column: 1 }, fieldPositions: {} }) as unknown as DataRecord;

const events = [
  record("a", { label: "Launch", start: "2026-03-01", end: "2026-03-05", status: "done" }),
  record("b", { label: "Beta", start: "2026-04-10T09:00:00Z", end: "2026-02-30" }),
];

const projects = [record("p", { name: "Atlas", begins: "2026-05-01", ends: "2026-05-02", state: "draft" })];

const site = {
  config: { base: "" },
  nav: {},
  data: {},
  pages: [
    { url: "/events/a/", record: { collection: "events", id: "a" } },
    { url: "/events/b/", record: { collection: "events", id: "b" } },
  ],
  collections: {
    events: { name: "events", source: "events.json", records: events },
    projects: { name: "projects", source: "projects.json", records: projects },
  },
} as unknown as Site;

const page = { lang: "en", url: "/events/", frontMatter: {} } as unknown as Page;

function render(props: Record<string, unknown>, lang = "en"): string {
  const input = { props, page: { ...page, lang }, site, html: "" } as unknown as ComponentProps;
  return renderToString(timeline(input) as never);
}

test("the directive is timeline", () => {
  assert.equal(directive, "timeline");
});

test("a collection renders label, start, end and status as a table", () => {
  const out = render({ from: "events" });
  assert.match(
    out,
    /<th scope="col">Label<\/th><th scope="col">Start<\/th><th scope="col">End<\/th><th scope="col">Status<\/th>/,
  );
  assert.match(
    out,
    /<td class="timeline-cell" data-field="label"><a href="\/events\/a\/">Launch<\/a><\/td>/,
  );
  assert.match(
    out,
    /<td class="timeline-cell" data-field="start"><time datetime="2026-03-01">March 1, 2026<\/time><\/td>/,
  );
  assert.match(
    out,
    /<td class="timeline-cell" data-field="end"><time datetime="2026-03-05">March 5, 2026<\/time><\/td>/,
  );
  assert.match(out, /<td class="timeline-cell" data-field="status"><span class="field-status" data-value="done">/);
});

test("an items JSON attribute renders rows without a collection", () => {
  const out = render({
    items: JSON.stringify([
      { label: "Kickoff", start: "2026-01-12", end: "2026-01-16", status: "done" },
      { label: "Ship", start: "2026-02-02", end: "2026-02-06", status: "late" },
    ]),
  });
  assert.match(out, /<td class="timeline-cell" data-field="label">Kickoff<\/td>/);
  assert.match(out, /<time datetime="2026-01-12">January 12, 2026<\/time>/);
  assert.match(out, /<time datetime="2026-02-06">February 6, 2026<\/time>/);
  assert.match(out, /data-value="late"/);
});

test("ISO dates and date-times render as time, anything else is a visible message", () => {
  const out = render({ from: "events" });
  assert.match(out, /<time datetime="2026-04-10">April 10, 2026<\/time>/);
  assert.equal((out.match(new RegExp(INVALID_CLASS, "g")) ?? []).length, 1);
  assert.match(out, new RegExp(`class="${INVALID_CLASS}"`));
  assert.match(out, /&quot;2026-02-30&quot; in field &quot;end&quot; is not an ISO 8601 date\./);

  const notIso = render({ items: JSON.stringify([{ label: "Soon", start: "March 1", end: "2026-03-02" }]) });
  assert.equal((notIso.match(new RegExp(INVALID_CLASS, "g")) ?? []).length, 1);
  assert.match(notIso, /&quot;March 1&quot; in field &quot;start&quot; is not an ISO 8601 date\./);
});

test("a field the rows do not have is a visible message in its cell", () => {
  const out = render({ from: "events" });
  assert.equal((out.match(new RegExp(MISSING_CLASS, "g")) ?? []).length, 1);
  assert.match(out, /class="timeline-missing">No field named &quot;status&quot;\./);

  const custom = render({ items: JSON.stringify([{ name: "Atlas", begins: "2026-05-01" }]), label: "name", start: "begins", end: "ends", status: "state" });
  assert.match(custom, /data-field="label">Atlas<\/td>/);
  assert.match(custom, /data-field="start"><time datetime="2026-05-01">May 1, 2026<\/time>/);
  assert.equal((custom.match(new RegExp(MISSING_CLASS, "g")) ?? []).length, 2);
  assert.match(custom, /No field named &quot;ends&quot;\./);
});

test("custom field names read the same values from a collection", () => {
  const out = render({ from: "projects", label: "name", start: "begins", end: "ends", status: "state" });
  assert.match(out, /data-field="label">Atlas<\/td>/);
  assert.match(out, /<time datetime="2026-05-01">May 1, 2026<\/time>/);
  assert.match(out, /data-value="draft"/);
});

test("an unknown collection shows a note instead of a table", () => {
  const out = render({ from: "films" });
  assert.match(out, new RegExp(`class="${ERROR_CLASS}" role="note"`));
  assert.match(out, /The site has no collection named &quot;films&quot;\./);
  assert.ok(!out.includes("<table"));
});

test("a missing collection and malformed items show a setup message", () => {
  assert.match(render({}), /timeline needs a collection in `from` or rows in `items`\./);
  assert.match(render({ items: "not json" }), /timeline needs a collection/);
  assert.match(render({ items: '{"label":"Kickoff"}' }), /timeline needs a collection/);
});

test("a caption is rendered and names the scroll region", () => {
  const out = render({ from: "events", caption: "Project timeline" });
  assert.match(out, /role="region" aria-label="Project timeline"/);
  assert.match(out, /<caption>Project timeline<\/caption>/);
});

test("a Persian page formats dates in Persian", () => {
  const out = render({ from: "events" }, "fa");
  assert.match(out, /<time datetime="2026-03-01">۱۰ اسفند ۱۴۰۴<\/time>/);
  assert.match(out, /<th scope="col">برچسب<\/th>/);
});
