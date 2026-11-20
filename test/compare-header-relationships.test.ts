import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { renderToString } from "preact-render-to-string";
import type { ComponentProps, DataRecord, Page, Site } from "@velella/mizzen/contracts";
import compare, { DIFF_MARKER_CLASS } from "../components/compare/index.ts";
import { activate, type CompareDocument, type CompareEnv } from "../components/compare/client.ts";
import { dataRecord } from "./helpers/record.ts";

const record = (id: string, fields: Record<string, unknown>): DataRecord => dataRecord({ id, fields });

const books = [
  record("a", { title: "Alpha", pages: 120, draft: false, note: "same" }),
  record("b", { title: "Beta", pages: 80, draft: true, note: "same" }),
];

const site = {
  config: { base: "" },
  nav: {},
  data: {},
  pages: books.map((book) => ({ url: `/books/${book.id}/`, record: { collection: "books", id: book.id } })),
  collections: { books: { name: "books", source: "books.yml", records: books } },
} as unknown as Site;

const page = { lang: "en", url: "/books/", frontMatter: {} } as unknown as Page;

const fields = JSON.stringify([
  { field: "pages", label: "Pages", kind: "number" },
  { field: "draft", label: "Draft", kind: "boolean" },
  { field: "note", label: "Note", kind: "text" },
]);

function docOf(): Document {
  const input = { props: { from: "books", ids: "a,b", fields }, page, site, html: "" } as unknown as ComponentProps;
  return new JSDOM(`<!doctype html><html lang="en"><body>${renderToString(compare(input) as never)}</body></html>`).window
    .document;
}

const cellsOf = (row: Element): Element[] => [...row.children];
const rowsOf = (document: Document): Element[] => [...document.querySelectorAll("tbody tr")];
const headerOf = (row: Element): Element | null => row.querySelector('th[scope="row"]');

test("every record is a column header and every field name a row header", () => {
  const document = docOf();
  const table = document.querySelector("table");
  const thead = table?.querySelector("thead");
  const tbody = table?.querySelector("tbody");
  assert.ok(thead, "the table has a head");
  assert.ok(tbody, "the table has a body");

  const columns = [...thead.querySelectorAll("th")];
  assert.deepEqual(columns.map((th) => th.getAttribute("scope")), ["col", "col"]);
  assert.deepEqual(columns.map((th) => th.getAttribute("data-compare-column")), ["0", "1"]);
  assert.deepEqual(columns.map((th) => th.textContent), ["Alpha", "Beta"]);

  const rows = rowsOf(document);
  assert.equal(rows.length, 3);
  for (const [at, label] of ["Pages", "Draft", "Note"].entries()) {
    const header = headerOf(rows[at]!);
    assert.equal(header?.getAttribute("scope"), "row");
    assert.ok(header?.textContent?.startsWith(label), `row ${at} is named ${label}`);
    const cells = cellsOf(rows[at]!);
    assert.equal(cells[0], header, "the row header comes first");
    assert.equal(cells.length, 3, "one row header and one cell per record");
    assert.deepEqual(
      cells.slice(1).map((cell) => cell.getAttribute("data-compare-column")),
      ["0", "1"],
      "the cells stay in the column headers' order",
    );
  }
});

test("a difference marker sits inside the row header, never in place of it", () => {
  const document = docOf();
  const differing = rowsOf(document).filter((row) => row.hasAttribute("data-diff"));
  assert.equal(differing.length, 2, "pages and draft differ");

  for (const row of differing) {
    const header = headerOf(row);
    assert.ok(header, "the differing row keeps its row header");
    assert.ok(header.querySelector(`.${DIFF_MARKER_CLASS}`), "the marker is inside that header");
    assert.equal(cellsOf(row)[0], header, "and the marker does not add a cell");
  }
});

test("the difference-only view hides rows but keeps every header relationship", () => {
  const document = docOf();
  const env: CompareEnv = { search: () => "?compare=diff", hash: () => "", replaceUrl: () => {} };
  activate(document as unknown as CompareDocument, env);

  const rows = rowsOf(document) as HTMLElement[];
  assert.equal(rows.length, 3, "hiding keeps every row in the document");
  const hidden = rows.filter((row) => row.hidden);
  assert.equal(hidden.length, 1);
  assert.ok(headerOf(hidden[0]!)?.textContent?.startsWith("Note"), "the equal row is the hidden one");

  for (const row of rows) {
    assert.ok(headerOf(row), "hidden and visible rows keep their row headers");
    assert.deepEqual(
      cellsOf(row).slice(1).map((cell) => cell.getAttribute("data-compare-column")),
      ["0", "1"],
    );
  }

  const columns = [...document.querySelectorAll("thead th[scope='col']")];
  assert.deepEqual(columns.map((th) => th.getAttribute("data-compare-column")), ["0", "1"]);
});
