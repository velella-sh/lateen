import assert from "node:assert/strict";
import { test } from "node:test";
import type { DataRecord, Page, Site } from "@velella/mizzen/contracts";
import { selectRecords } from "../src/records.ts";

const record = (id: string, fields: Record<string, unknown>): DataRecord =>
  ({ id, fields, position: { line: 1, column: 1 }, fieldPositions: {} }) as unknown as DataRecord;

const books = [
  record("a", { title: "Alpha", author: "ada", year: 2019, parent: "" }),
  record("b", { title: "Beta", author: "ada", year: 2021, parent: "a" }),
  record("c", { title: "Gamma", author: "grace", year: 2020, parent: "a" }),
];

const site = {
  config: { base: "" },
  nav: {},
  data: {},
  pages: [
    { url: "/books/a/", record: { collection: "books", id: "a" } },
    { url: "/books/b/", record: { collection: "books", id: "b" } },
    { url: "/books/c/", record: { collection: "books", id: "c" } },
    { url: "/guide/" },
  ],
  collections: { books: { name: "books", source: "books.yml", records: books } },
} as unknown as Site;

const page = { lang: "en", url: "/list/", record: { collection: "books", id: "a" } } as unknown as Page;

const ids = (selection: ReturnType<typeof selectRecords>) => (selection.ok ? selection.records.map((r) => r.id) : []);

test("selects the records of one collection with their fields and page URLs", () => {
  const selection = selectRecords(site, page, { collection: "books" });
  assert.equal(selection.ok, true);
  const records = selection.ok ? selection.records : [];
  assert.deepEqual(records.map((r) => r.id), ["a", "b", "c"]);
  assert.equal(records[1]?.fields.title, "Beta");
  assert.equal(records[0]?.url, "/books/a/");
});

test("filters by one field equal to a value, written as the data file writes it", () => {
  assert.deepEqual(ids(selectRecords(site, page, { collection: "books", filter: { field: "author", equals: "ada" } })), ["a", "b"]);
  assert.deepEqual(ids(selectRecords(site, page, { collection: "books", filter: { field: "year", equals: "2019" } })), ["a"]);
  assert.deepEqual(ids(selectRecords(site, page, { collection: "books", filter: { field: "year", equals: 2019 } })), ["a"]);
  assert.deepEqual(ids(selectRecords(site, page, { collection: "books", filter: { field: "author", equals: "nobody" } })), []);
});

test("a filter value can name a field of the page's own record, so a record lists its children", () => {
  assert.deepEqual(ids(selectRecords(site, page, { collection: "books", filter: { field: "parent", from: "id" } })), ["b", "c"]);
});

test("sorts by one field in both directions, numbers as numbers", () => {
  assert.deepEqual(ids(selectRecords(site, page, { collection: "books", sort: { field: "year" } })), ["a", "c", "b"]);
  assert.deepEqual(ids(selectRecords(site, page, { collection: "books", sort: { field: "year", order: "desc" } })), ["b", "c", "a"]);
  assert.deepEqual(ids(selectRecords(site, page, { collection: "books", sort: { field: "title" } })), ["a", "b", "c"]);
});

test("a limit keeps the first records after filtering and sorting", () => {
  assert.deepEqual(ids(selectRecords(site, page, { collection: "books", limit: 2 })), ["a", "b"]);
  assert.deepEqual(ids(selectRecords(site, page, { collection: "books", sort: { field: "year", order: "desc" }, limit: 1 })), ["b"]);
  assert.deepEqual(ids(selectRecords(site, page, { collection: "books", limit: 0 })), []);
});

test("an unknown collection is a typed error", () => {
  const selection = selectRecords(site, page, { collection: "films" });
  assert.equal(selection.ok, false);
  if (!selection.ok) {
    assert.equal(selection.error.code, "unknown-collection");
    assert.equal(selection.error.name, "films");
    assert.match(selection.error.message, /"films"/);
  }
});

test("an unknown filter or sort field is a typed error", () => {
  for (const query of [
    { collection: "books", filter: { field: "editor", equals: "x" } },
    { collection: "books", filter: { field: "parent", from: "editor" } },
    { collection: "books", sort: { field: "editor" } },
  ]) {
    const selection = selectRecords(site, page, query);
    assert.equal(selection.ok, false);
    if (!selection.ok) {
      assert.equal(selection.error.code, "unknown-field");
      assert.equal(selection.error.name, "editor");
      assert.match(selection.error.message, /"editor"/);
    }
  }
});
