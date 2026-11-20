import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { renderToString } from "preact-render-to-string";
import type { ComponentProps, DataRecord, Page, Site } from "@velella/mizzen/contracts";
import recordTable from "../components/record-table/index.ts";
import {
  BUTTON_SELECTOR,
  SELECT_FILTER_SELECTOR,
  TEXT_FILTER_SELECTOR,
  WRAPPER_SELECTOR,
  activate,
  type SortDocument,
} from "../components/record-table/client.ts";
import { dataRecord } from "./helpers/record.ts";

const record = (id: string, fields: Record<string, unknown>): DataRecord => dataRecord({ id, fields });

const books = [
  record("a", { title: "Alpha", pages: 120, published: "2026-11-09" }),
  record("b", { title: "Beta", pages: 80, published: "2026-02-03" }),
  record("c", { title: "Gamma", pages: 120, published: "2026-06-01" }),
  record("d", { title: "Delta", pages: 80, published: "2026-03-04" }),
  record("e", { title: "Beta", pages: 300, published: "2026-01-01" }),
];

const site = {
  config: { base: "" },
  nav: {},
  data: {},
  pages: books.map((book) => ({ url: `/books/${book.id}/`, record: { collection: "books", id: book.id } })),
  collections: { books: { name: "books", source: "books.yml", records: books } },
} as unknown as Site;

const page = { lang: "en", url: "/books/", frontMatter: {} } as unknown as Page;

const columns = JSON.stringify([
  { field: "title", label: "Title", filter: true },
  { field: "pages", label: "Pages", kind: "number", filter: true },
  { field: "published", label: "Published", kind: "date" },
]);

function table(props: Record<string, unknown>): string {
  const input = { props, page, site, html: "" } as unknown as ComponentProps;
  return renderToString(recordTable(input) as never);
}

/** Two tables on one page, which is what asks the address to prefix each table's keys. */
const twoTables = (): string => table({ from: "books", columns }) + table({ from: "books", columns });

function pageOf(body: string, url = "http://localhost/books/"): Document {
  const dom = new JSDOM(`<!doctype html><html lang="en"><body>${body}</body></html>`, { url });
  activate(dom.window.document as unknown as SortDocument);
  return dom.window.document;
}

const wrappers = (document: Document): HTMLElement[] =>
  [...document.querySelectorAll(WRAPPER_SELECTOR)].map((node) => node as HTMLElement);

const rowsOf = (document: Document, at = 0): HTMLElement[] =>
  [...wrappers(document)[at]!.querySelectorAll("tbody tr")].map((node) => node as HTMLElement);

const titles = (document: Document, at = 0): string[] =>
  rowsOf(document, at).map((row) => row.querySelector("a")?.textContent ?? "");

const shown = (document: Document, at = 0): string[] =>
  rowsOf(document, at)
    .filter((row) => !row.hidden)
    .map((row) => row.querySelector("a")?.textContent ?? "");

const selects = (document: Document, at = 0): HTMLSelectElement[] =>
  [...wrappers(document)[at]!.querySelectorAll(SELECT_FILTER_SELECTOR)].map(
    (node) => node as HTMLSelectElement,
  );

const paramsOf = (document: Document): URLSearchParams => new URLSearchParams(document.location.search);

function sortByTitle(document: Document, at = 0): void {
  (wrappers(document)[at]!.querySelector(BUTTON_SELECTOR) as HTMLElement).click();
}

function type(document: Document, value: string, at = 0): void {
  const input = wrappers(document)[at]!.querySelector(TEXT_FILTER_SELECTOR) as HTMLInputElement;
  input.value = value;
  input.dispatchEvent(new (document.defaultView as Window & typeof globalThis).Event("input", { bubbles: true }));
}

function choose(document: Document, select: number, value: string, at = 0): void {
  const input = selects(document, at)[select]!;
  input.value = value;
  input.dispatchEvent(new (document.defaultView as Window & typeof globalThis).Event("change", { bubbles: true }));
}

test("the sort and filters round trip through the address", () => {
  const first = pageOf(table({ from: "books", columns }));
  sortByTitle(first);
  type(first, "beta");
  choose(first, 1, "80");

  const params = paramsOf(first);
  assert.equal(params.get("sort"), "title:asc");
  assert.equal(params.get("q"), "beta");
  assert.equal(params.get("filter.1"), "80");

  const second = pageOf(table({ from: "books", columns }), `http://localhost/books/${first.location.search}`);
  assert.deepEqual(titles(second), ["Alpha", "Beta", "Beta", "Delta", "Gamma"], "the saved sort returns");
  assert.equal((second.querySelector(TEXT_FILTER_SELECTOR) as HTMLInputElement).value, "beta");
  assert.equal(selects(second)[1]!.value, "80");
  assert.deepEqual(shown(second), ["Beta"], "the saved filters return");
});

test("back and forward replace the view from the address", () => {
  const document = pageOf(table({ from: "books", columns }), "http://localhost/books/?sort=title:desc&q=beta");
  assert.deepEqual(titles(document), ["Gamma", "Delta", "Beta", "Beta", "Alpha"]);
  assert.deepEqual(shown(document), ["Beta", "Beta"]);

  document.defaultView!.history.replaceState(null, "", "?q=gamma");
  document.defaultView!.dispatchEvent(new (document.defaultView as Window & typeof globalThis).Event("popstate"));
  assert.deepEqual(titles(document), ["Alpha", "Beta", "Gamma", "Delta", "Beta"], "no sort restores the sent order");
  assert.deepEqual(shown(document), ["Gamma"]);
  assert.equal((document.querySelector(TEXT_FILTER_SELECTOR) as HTMLInputElement).value, "gamma");
});

test("a page with two tables prefixes each table's keys", () => {
  const document = pageOf(twoTables());
  sortByTitle(document, 0);
  choose(document, 0, "Beta", 1);

  const params = paramsOf(document);
  assert.equal(params.get("t1.sort"), "title:asc");
  assert.equal(params.get("t2.filter.0"), "Beta");
  assert.equal(params.get("sort"), null, "no bare key beside a prefixed one");
  assert.equal(params.get("filter.0"), null);

  const restored = pageOf(twoTables(), `http://localhost/books/${document.location.search}`);
  assert.deepEqual(titles(restored, 0), ["Alpha", "Beta", "Beta", "Delta", "Gamma"], "the first table sorts");
  assert.deepEqual(titles(restored, 1), ["Alpha", "Beta", "Gamma", "Delta", "Beta"], "the second does not");
  assert.deepEqual(shown(restored, 0), ["Alpha", "Beta", "Beta", "Delta", "Gamma"]);
  assert.deepEqual(shown(restored, 1), ["Beta", "Beta"], "only the second table filters");
  assert.equal(selects(restored, 0)[0]!.value, "");
  assert.equal(selects(restored, 1)[0]!.value, "Beta");
});

test("unknown and malformed parameters are ignored without an error", () => {
  const body = twoTables();
  const search =
    "?t1.sort=title:sideways&t1.filter.0=missing&t2.sort=unknown&t3.sort=title:asc&sort=title:desc&nope=1";
  const document = pageOf(body, `http://localhost/books/${search}`);

  assert.deepEqual(titles(document, 0), ["Alpha", "Beta", "Gamma", "Delta", "Beta"]);
  assert.deepEqual(titles(document, 1), ["Alpha", "Beta", "Gamma", "Delta", "Beta"]);
  assert.deepEqual(shown(document, 0), ["Alpha", "Beta", "Gamma", "Delta", "Beta"]);
  assert.deepEqual(shown(document, 1), ["Alpha", "Beta", "Gamma", "Delta", "Beta"]);
  assert.equal(selects(document, 0)[0]!.value, "");
  assert.equal(document.location.search, search, "reading the address never rewrites it");
});
