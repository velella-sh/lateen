import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToString } from "preact-render-to-string";
import type { ComponentProps, DataRecord, Page, Site } from "@velella/mizzen/contracts";
import timeline, { ERROR_CLASS, INVALID_CLASS, MISSING_CLASS, directive } from "../components/timeline/index.ts";
import { dataRecord } from "./helpers/record.ts";

const record = (id: string, fields: Record<string, unknown>): DataRecord => dataRecord({ id, fields });

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
    /<td class="timeline-cell" data-field="start"><time datetime="2026-03-01">1 March 2026<\/time><\/td>/,
  );
  assert.match(
    out,
    /<td class="timeline-cell" data-field="end"><time datetime="2026-03-05">5 March 2026<\/time><\/td>/,
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
  assert.match(out, /<time datetime="2026-01-12">12 January 2026<\/time>/);
  assert.match(out, /<time datetime="2026-02-06">6 February 2026<\/time>/);
  assert.match(out, /data-value="late"/);
});

test("ISO dates and date-times render as time, anything else is a visible message", () => {
  const out = render({ from: "events" });
  assert.match(out, /<time datetime="2026-04-10">10 April 2026<\/time>/);
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
  assert.match(custom, /data-field="start"><time datetime="2026-05-01">1 May 2026<\/time>/);
  assert.equal((custom.match(new RegExp(MISSING_CLASS, "g")) ?? []).length, 2);
  assert.match(custom, /No field named &quot;ends&quot;\./);
});

test("custom field names read the same values from a collection", () => {
  const out = render({ from: "projects", label: "name", start: "begins", end: "ends", status: "state" });
  assert.match(out, /data-field="label">Atlas<\/td>/);
  assert.match(out, /<time datetime="2026-05-01">1 May 2026<\/time>/);
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
  assert.match(out, /<time datetime="2026-03-01">۱ مارس ۲۰۲۶<\/time>/);
  assert.match(out, /<th scope="col">برچسب<\/th>/);
});

test("start and end both render in the page calendar for English, Persian and Arabic", () => {
  const items = JSON.stringify([{ label: "Release", start: "2026-11-09", end: "2026-11-12" }]);
  const expected = [
    ["en", "9 November 2026", "12 November 2026"],
    ["fa", "۹ نوامبر ۲۰۲۶", "۱۲ نوامبر ۲۰۲۶"],
    ["ar", "٩ نوفمبر ٢٠٢٦", "١٢ نوفمبر ٢٠٢٦"],
  ] as const;
  for (const [lang, start, end] of expected) {
    const out = render({ items }, lang);
    assert.ok(out.includes(`data-field="start"><time datetime="2026-11-09">${start}</time>`), lang);
    assert.ok(out.includes(`data-field="end"><time datetime="2026-11-12">${end}</time>`), lang);
  }
});

test("month-only, year-only and mixed endpoints keep the precision they were written with", () => {
  const items = JSON.stringify([
    { label: "Month", start: "2026-11", end: "2027-01" },
    { label: "Year", start: "2025", end: "2027" },
    { label: "Mixed", start: "2026", end: "2026-11-12" },
  ]);
  const expected: readonly (readonly [string, readonly string[]])[] = [
    ["en", ["November 2026", "January 2027", "2025", "2027", "2026", "12 November 2026"]],
    ["fa", ["نوامبر ۲۰۲۶", "ژانویه ۲۰۲۷", "۲۰۲۵", "۲۰۲۷", "۲۰۲۶", "۱۲ نوامبر ۲۰۲۶"]],
    ["ar", ["نوفمبر ٢٠٢٦", "يناير ٢٠٢٧", "٢٠٢٥", "٢٠٢٧", "٢٠٢٦", "١٢ نوفمبر ٢٠٢٦"]],
  ];
  for (const [lang, texts] of expected) {
    const out = render({ items }, lang);
    const cells = [...out.matchAll(/data-field="(?:start|end)"><time datetime="[^"]+">([^<]+)<\/time>/g)].map(
      (match) => match[1],
    );
    assert.deepEqual(cells, texts, lang);
  }

  // The machine value is the authored precision too, never the first day of the month or year.
  const out = render({ items }, "en");
  assert.ok(out.includes(`<time datetime="2026-11">November 2026</time>`));
  assert.ok(out.includes(`<time datetime="2025">2025</time>`));
  assert.ok(out.includes(`<time datetime="2026">2026</time>`));
});

test("an invalid endpoint keeps its message and the other endpoint still renders", () => {
  const badStart = render({
    items: JSON.stringify([{ label: "Bad start", start: "2026-02-30", end: "2027-01" }]),
  });
  assert.equal((badStart.match(new RegExp(INVALID_CLASS, "g")) ?? []).length, 1);
  assert.ok(badStart.includes(`&quot;2026-02-30&quot; in field &quot;start&quot; is not an ISO 8601 date.`));
  assert.ok(badStart.includes(`data-field="end"><time datetime="2027-01">January 2027</time>`));

  const badEnd = render({
    items: JSON.stringify([{ label: "Bad end", start: "2026-11-09", end: "2026-02-30" }]),
  });
  assert.ok(badEnd.includes(`data-field="start"><time datetime="2026-11-09">9 November 2026</time>`));
  assert.ok(badEnd.includes(`&quot;2026-02-30&quot; in field &quot;end&quot; is not an ISO 8601 date.`));
});

test("a Persian row keeps start before end in the DOM and dates machine-readable", () => {
  const out = render({ items: JSON.stringify([{ label: "Release", start: "2026-11-09", end: "2026-11-12" }]) }, "fa");
  const row = out.match(/<tr><td class="timeline-cell" data-field="label">Release<\/td>[\s\S]*?<\/tr>/)?.[0] ?? "";
  const start = row.indexOf(`data-field="start"`);
  const end = row.indexOf(`data-field="end"`);

  assert.ok(start >= 0 && end > start, "start cell comes before end cell in DOM order");
  assert.ok(row.includes(`<time datetime="2026-11-09">۹ نوامبر ۲۰۲۶</time>`));
  assert.ok(row.includes(`<time datetime="2026-11-12">۱۲ نوامبر ۲۰۲۶</time>`));
  assert.ok(!row.includes(`dir="ltr"`), "the row follows the page direction");
});
