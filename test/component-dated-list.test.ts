import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { renderToString } from "preact-render-to-string";
import type { ComponentProps, DataRecord, Page, Site } from "@velella/mizzen/contracts";
import datedList, {
  ERROR_CLASS,
  GROUP_CLASS,
  INVALID_CLASS,
  ITEMS_CLASS,
  directive,
} from "../components/dated-list/index.ts";
import { dataRecord } from "./helpers/record.ts";

const record = (id: string, fields: Record<string, unknown>): DataRecord => dataRecord({ id, fields });

const events = [
  record("c", { label: "Second", date: "2026-11-09" }),
  record("a", { label: "Alpha", date: "2026-11-09", status: "done" }),
  record("b", { label: "Beta", date: "2026-12-01" }),
  record("bad", { label: "Broken", date: "2026-02-30" }),
  record("none", { label: "Undated" }),
];

const posts = [record("p", { label: "Post", published: "2026-03-05", state: "late" })];

const site = {
  config: {
    base: "",
    theme: { options: { status: { values: { done: { tone: "positive", label: "Done" } } } } },
  },
  nav: {},
  data: {},
  pages: [
    { url: "/events/a/", record: { collection: "events", id: "a" } },
    { url: "/events/b/", record: { collection: "events", id: "b" } },
    { url: "/events/c/", record: { collection: "events", id: "c" } },
  ],
  collections: {
    events: { name: "events", source: "events.yml", records: events },
    posts: { name: "posts", source: "posts.yml", records: posts },
    empty: { name: "empty", source: "empty.yml", records: [] },
  },
} as unknown as Site;

const page = { lang: "en", url: "/events/", frontMatter: {} } as unknown as Page;

function render(props: Record<string, unknown>, lang = "en"): string {
  const input = { props, page: { ...page, lang }, site, html: "" } as unknown as ComponentProps;
  return renderToString(datedList(input) as never);
}

/** The same rows the `events` collection holds, as the directive's `items` attribute. */
const items = [
  { date: "2026-11-09", label: "Second", url: "/events/c/" },
  { date: "2026-11-09", label: "Alpha", url: "/events/a/", status: "done" },
  { date: "2026-12-01", label: "Beta", url: "/events/b/" },
  { date: "2026-02-30", label: "Broken" },
  { label: "Undated" },
];

test("the directive is dated-list", () => {
  assert.equal(directive, "dated-list");
});

test("months are sections in date order, each with a heading and an ordered list", () => {
  const out = render({ from: "events" });
  assert.match(out, new RegExp(`<section class="${GROUP_CLASS}"><h2>November 2026</h2><ol class="${ITEMS_CLASS}">`));
  assert.match(out, /<h2>December 2026<\/h2>/);
  assert.ok(out.indexOf("November 2026") < out.indexOf("December 2026"));
  assert.equal((out.match(new RegExp(GROUP_CLASS, "g")) ?? []).length, 2);
});

test("a day is a time element with its formatted day, and ties keep the source order", () => {
  const out = render({ from: "events" });
  assert.match(out, /<time class="dated-list-day" datetime="2026-11-09">9<\/time>/);
  assert.ok(out.indexOf('href="/events/c/"') < out.indexOf('href="/events/a/"'), "same-day rows keep source order");
  assert.ok(out.indexOf('datetime="2026-11-09"') < out.indexOf('datetime="2026-12-01"'));
});

test("a label links to the record page, and the status uses the status component's tone", () => {
  const out = render({ from: "events", status: "status" });
  assert.match(out, /<a class="dated-list-link" href="\/events\/a\/">Alpha<\/a>/);
  assert.match(out, /class="status status-positive"/);
});

test("from and items render the same list", () => {
  const from = render({ from: "events", status: "status" });
  assert.equal(render({ items: JSON.stringify(items) }), from);
  assert.equal(render({ items }), from);
});

test("an invalid or missing date is shown in a trailing section, never dropped", () => {
  const out = render({ from: "events" });
  assert.match(out, new RegExp(`<section class="${INVALID_CLASS}">`));
  assert.match(out, /Records with no valid date are listed here\./);
  assert.match(out, /<span class="dated-list-day">2026-02-30<\/span>/);
  assert.ok(out.includes("Broken") && out.includes("Undated"), "the rows without a date keep their labels");
  assert.ok(out.indexOf(`class="${INVALID_CLASS}"`) > out.lastIndexOf(`class="${GROUP_CLASS}"`));
  assert.equal((out.match(/class="dated-list-item"/g) ?? []).length, 5);
});

test("the date and status props name the fields of a collection", () => {
  const out = render({ from: "posts", date: "published", status: "state" });
  assert.match(out, /<h2>March 2026<\/h2>/);
  assert.match(out, /class="status status-neutral"/);
  assert.doesNotMatch(out, new RegExp(INVALID_CLASS));
  assert.match(render({ from: "posts" }), new RegExp(INVALID_CLASS));
});

test("an empty collection renders nothing, with no empty heading", () => {
  assert.equal(render({ from: "empty" }), "");
  assert.equal(render({ items: "[]" }), "");
});

test("an unknown collection shows a visible note", () => {
  const out = render({ from: "films" });
  assert.match(out, new RegExp(`class="${ERROR_CLASS}" role="note"`));
  assert.match(out, /The site has no collection named &quot;films&quot;\./);
  assert.ok(!out.includes("<section"));
});

test("a Persian page groups and numbers dates in Persian", () => {
  const out = render({ from: "events" }, "fa");
  assert.match(out, /<h2>نوامبر ۲۰۲۶<\/h2>/);
  assert.match(out, /<time class="dated-list-day" datetime="2026-11-09">۹<\/time>/);
});

test("an Arabic page groups by Gregorian month and uses Arabic-Indic day digits", () => {
  const out = render({ from: "events" }, "ar");
  assert.match(out, /<h2>[^<]*نوفمبر[^<]*<\/h2>/);
  assert.match(out, /<time class="dated-list-day" datetime="2026-11-09">٩<\/time>/);
});

