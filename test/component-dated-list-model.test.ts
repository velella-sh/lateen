// The dated list decides everything in a pure view model: grouping, the feed and calendar
// choice, empty states, and the range inputs. These tests pin the model's data so the markup
// stays a thin translation of it.
import assert from "node:assert/strict";
import { test } from "node:test";
import type { DataRecord, Page, Site } from "@velella/mizzen/contracts";
import { datedListModel } from "../components/dated-list/index.ts";
import { dataRecord } from "./helpers/record.ts";

const record = (id: string, fields: Record<string, unknown>): DataRecord => dataRecord({ id, fields });

const events = [
  record("c", { label: "Second", date: "2026-11-09" }),
  record("a", { label: "Alpha", date: "2026-11-09" }),
  record("b", { label: "Beta", date: "2026-12-01" }),
];

const site = {
  config: { base: "" },
  nav: {},
  data: {},
  pages: [],
  collections: {
    events: { name: "events", source: "events.yml", records: events },
    empty: { name: "empty", source: "empty.yml", records: [] },
  },
} as unknown as Site;

const page = { lang: "en", url: "/events/", frontMatter: {} } as unknown as Page;

function model(props: Record<string, unknown>, lang = "en") {
  return datedListModel(props, { page: { ...page, lang } as Page, site });
}

/** The model of a list that has content; fails the test when it is an error or empty. */
function list(props: Record<string, unknown>, lang = "en") {
  const result = model(props, lang);
  assert.equal(result.kind, "list");
  return result as Extract<ReturnType<typeof datedListModel>, { kind: "list" }>;
}

const items = [
  { date: "2026-11-09", label: "Second" },
  { date: "2026-11-09", label: "Alpha" },
  { date: "2026-12-01", label: "Beta" },
];

test("rows group by month in date order, and same-day rows keep the source order", () => {
  const result = list({ items });
  assert.deepEqual(result.months.map((month) => month.text), ["November 2026", "December 2026"]);
  assert.deepEqual(result.months[0]!.entries.map((entry) => entry.row.label), ["Second", "Alpha"]);
  assert.deepEqual(result.months.map((month) => month.id), ["dated-list-11-2026", "dated-list-12-2026"]);
  assert.equal(result.years.length, 0);
});

test("from and items give the same model", () => {
  assert.deepEqual(model({ from: "events" }), model({ items }));
});

test("order=desc reverses the months and their rows", () => {
  const result = list({ items, order: "desc" });
  assert.deepEqual(result.months.map((month) => month.text), ["December 2026", "November 2026"]);
  assert.deepEqual(result.months[1]!.entries.map((entry) => entry.row.label), ["Alpha", "Second"]);
});

test("group=year adds year groups and shifts the month heading level", () => {
  const result = list({ items, group: "year", level: "3" });
  assert.equal(result.level, 3);
  assert.equal(result.monthLevel, 4);
  assert.deepEqual(result.years.map((year) => year.text), ["2026"]);
  assert.deepEqual(result.years[0]!.months.map((month) => month.text), ["November 2026", "December 2026"]);
});

test("a level that would skip one falls back to 2", () => {
  assert.equal(list({ items, level: "1" }).level, 2);
  assert.equal(list({ items, level: "6", group: "year" }).level, 2);
  assert.equal(list({ items, level: "6" }).monthLevel, 6);
});

test("toc is on only when asked for and there is something to link", () => {
  assert.equal(list({ items, toc: true }).toc, true);
  assert.equal(list({ items, toc: "true" }).toc, true);
  assert.equal(list({ items }).toc, false);
  assert.equal(list({ items, toc: "false" }).toc, false);
});

test("a Persian page groups in its own calendar", () => {
  const result = list({ items }, "fa");
  assert.deepEqual(result.months.map((month) => month.text), ["۱۴۰۵ آبان", "۱۴۰۵ آذر"]);
});

test("safe feed and calendar addresses are kept, trimmed; unsafe ones are dropped", () => {
  const result = list({ items, feed: " /posts/feed.xml ", calendar: "https://example.com/posts.ics" });
  assert.equal(result.feedUrl, "/posts/feed.xml");
  assert.equal(result.calendarUrl, "https://example.com/posts.ics");
  for (const address of ["http://example.com/feed.xml", "feed.xml", "javascript:alert(1)", "//evil.example/feed.xml", ""]) {
    const dropped = list({ items, feed: address, calendar: address });
    assert.equal(dropped.feedUrl, "", address);
    assert.equal(dropped.calendarUrl, "", address);
  }
});

test("missing, broken, or empty items mean nothing renders", () => {
  assert.deepEqual(model({}), { kind: "none" });
  assert.deepEqual(model({ items: "not json" }), { kind: "none" });
  assert.deepEqual(model({ items: "[]" }), { kind: "none" });
  assert.deepEqual(model({ from: "empty" }), { kind: "none" });
});

test("a feed address alone does not make an empty list render", () => {
  assert.deepEqual(model({ items: "[]", feed: "/posts/feed.xml", calendar: "/posts/posts.ics" }), { kind: "none" });
});

test("an unknown collection names the problem instead of grouping", () => {
  assert.deepEqual(model({ from: "films" }), {
    kind: "error",
    lang: "en",
    key: "record_table_unknown_collection",
    name: "films",
  });
});

test("a range covers every month, counts what falls outside, and ignores months without start", () => {
  const rows = [
    { date: "2024-11-20", label: "Before" },
    { date: "2025-01-15", label: "January" },
    { date: "2025-03-05", label: "March" },
  ];
  const result = list({ items: rows, start: "2025-01-01", months: 3 });
  assert.deepEqual(result.months.map((month) => month.text), ["January 2025", "February 2025", "March 2025"]);
  assert.deepEqual(result.months.map((month) => month.entries.length), [1, 0, 1]);
  assert.equal(result.outside, 1);

  const noStart = list({ items: rows, months: 3 });
  assert.deepEqual(noStart.months.map((month) => month.text), ["November 2024", "January 2025", "March 2025"]);
  assert.equal(noStart.outside, 0);
});

test("a range in descending order reverses the months, empty ones included", () => {
  const result = list({ items, start: "2026-11-01", months: 3, order: "desc" });
  assert.deepEqual(result.months.map((month) => month.text), ["January 2027", "December 2026", "November 2026"]);
});

test("rows with a broken or missing date keep the date as written", () => {
  const result = list({
    items: [
      { date: "2026-11-09", label: "Fine" },
      { date: " 2026-02-30 ", label: "Broken" },
      { date: 20261109, label: "Numeric" },
      { label: "Undated" },
    ],
  });
  assert.deepEqual(result.invalid, [
    { written: "2026-02-30", row: { date: " 2026-02-30 ", label: "Broken" } },
    { written: "20261109", row: { date: 20261109, label: "Numeric" } },
    { written: "", row: { label: "Undated" } },
  ]);
});

test("broken dates alone still make a list, so they are never dropped", () => {
  const result = list({ items: [{ label: "Undated" }] });
  assert.equal(result.months.length, 0);
  assert.equal(result.invalid.length, 1);
});

test("the model is pure: the same inputs give the same data and the rows are not mutated", () => {
  const rows = [{ date: "2026-12-01", label: "Beta" }, { date: "2026-11-09", label: "Alpha" }];
  const before = JSON.stringify(rows);
  const first = model({ items: rows, group: "year", toc: true });
  const second = model({ items: rows, group: "year", toc: true });
  assert.deepEqual(first, second);
  assert.equal(JSON.stringify(rows), before);
});