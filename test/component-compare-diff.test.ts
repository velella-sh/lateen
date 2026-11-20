import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToString } from "preact-render-to-string";
import type { ComponentProps, DataRecord, Page, Site } from "@velella/mizzen/contracts";
import compare, { DIFF_CLASS, DIFF_MARKER_CLASS } from "../components/compare/index.ts";

const record = (id: string, fields: Record<string, unknown>): DataRecord =>
  ({ id, fields, position: { line: 1, column: 1 }, fieldPositions: {} }) as unknown as DataRecord;

const books = [
  record("a", { title: "Alpha", pages: 120, tags: ["docs", "web"], price: "1.0", note: "same" }),
  record("b", { title: "Beta", pages: 120, tags: ["web", "docs"], price: "1.00", note: "same" }),
  record("c", { title: "Gamma", pages: 80, tags: ["web"], price: "1.00" }),
];

const site = {
  config: { base: "" },
  nav: {},
  data: {},
  pages: ["a", "b", "c"].map((id) => ({ url: `/books/${id}/`, record: { collection: "books", id } })),
  collections: { books: { name: "books", source: "books.yml", records: books } },
} as unknown as Site;

const page = { lang: "en", url: "/books/", frontMatter: {} } as unknown as Page;

const fields = (...names: string[]): string =>
  JSON.stringify(
    names.map((field) => ({
      field,
      label: field,
      kind: field === "pages" || field === "price" ? "number" : field === "tags" ? "list" : "text",
    })),
  );

function render(ids: string, names: string[]): string {
  const input = {
    props: { from: "books", ids, fields: fields(...names) },
    page,
    site,
    html: "",
  } as unknown as ComponentProps;
  return renderToString(compare(input) as never);
}

/** One row of the table, from its opening tag to its close, named by its header text. */
function rowOf(out: string, label: string): string {
  const start = out.indexOf(`<th scope="row">${label}`);
  assert.notEqual(start, -1, `no row named ${label}`);
  return out.slice(out.lastIndexOf("<tr", start), out.indexOf("</tr>", start));
}

test("equal rows are not marked, including numbers written differently, reordered lists, and values both records lack", () => {
  const out = render("a,b", ["pages", "tags", "price", "note", "edition"]);
  assert.ok(!out.includes(DIFF_CLASS), "no row differs");
  assert.ok(!out.includes(DIFF_MARKER_CLASS), "and none is named for assistive technology");
});

test("a differing row is marked and named in text, not only by its background", () => {
  const out = render("a,c", ["pages"]);
  const row = rowOf(out, "pages");
  assert.match(row, new RegExp(`<tr data-compare-row class="${DIFF_CLASS}" data-diff>`));
  assert.match(row, new RegExp(`<span class="${DIFF_MARKER_CLASS}"> Differs</span>`));
  assert.match(row, /<td class="compare-cell" data-kind="number" data-compare-column="0"><span class="compare-record">Alpha<\/span>120<\/td>/);
  assert.match(row, /<td class="compare-cell" data-kind="number" data-compare-column="1"><span class="compare-record">Gamma<\/span>80<\/td>/);
});

test("a number compares by value, so 1.0 and 1.00 are equal", () => {
  const out = render("a,c", ["price"]);
  assert.ok(!out.includes(DIFF_CLASS), "the row keeps its written forms out of the comparison");
});

test("a missing value differs from a present one, and two missing values are equal", () => {
  const present = render("a,c", ["note"]);
  assert.match(rowOf(present, "note"), new RegExp(`class="${DIFF_CLASS}"`));

  const absent = render("a,b", ["edition"]);
  assert.ok(!absent.includes(DIFF_CLASS), "both records lack edition");
});

test("a list in a different order is equal, and a list with other items differs", () => {
  const reordered = render("a,b", ["tags"]);
  assert.ok(!reordered.includes(DIFF_CLASS), "docs, web and web, docs are the same list");

  const changed = render("a,c", ["tags"]);
  assert.match(rowOf(changed, "tags"), new RegExp(`class="${DIFF_CLASS}"`), "docs, web and web differ");
});
