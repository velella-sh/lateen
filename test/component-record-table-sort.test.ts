import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { renderToString } from "preact-render-to-string";
import type { ComponentProps, DataRecord, Page, Site } from "@velella/mizzen/contracts";
import recordTable, { SORTABLE_CLASS } from "../components/record-table/index.ts";
import { activate, type SortDocument } from "../components/record-table/client.ts";

const record = (id: string, fields: Record<string, unknown>): DataRecord =>
  ({ id, fields, position: { line: 1, column: 1 }, fieldPositions: {} }) as unknown as DataRecord;

const books = [
  record("a", { title: "پای", pages: 120, published: "2026-11-09" }),
  record("b", { title: "آب", pages: 80, published: "2026-02-03" }),
  record("c", { title: "باب", pages: 300, published: "2026-06-01" }),
  record("d", { pages: 5, published: "not a date" }),
  record("e", { title: "آب", pages: 80, published: "2026-03-04" }),
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
  { field: "title", label: "Title" },
  { field: "pages", label: "Pages", kind: "number" },
  { field: "published", label: "Published", kind: "date" },
]);

function html(props: Record<string, unknown>): string {
  const input = { props, page, site, html: "" } as unknown as ComponentProps;
  return renderToString(recordTable(input) as never);
}

function docOf(props: Record<string, unknown>, lang = "en") {
  const document = new JSDOM(`<!doctype html><html lang="${lang}"><body>${html(props)}</body></html>`).window.document;
  return document;
}

const ids = (document: ReturnType<typeof docOf>): string[] =>
  [...document.querySelectorAll("tbody tr")].map(
    (row) => row.querySelector("a")?.getAttribute("href")?.replace("/books/", "").replace("/", "") ?? "",
  );

const buttons = (document: ReturnType<typeof docOf>): HTMLElement[] =>
  [...document.querySelectorAll(".record-table-sort")].map((node) => node as HTMLElement);

function sortBy(document: ReturnType<typeof docOf>, at: number): void {
  buttons(document)[at]!.click();
}

test("the static table has no visible control and no wrapper when nothing sorts", () => {
  const out = html({ from: "books", columns, paginated: true });
  assert.ok(!out.includes(SORTABLE_CLASS), "a paginated table has no sort wrapper");
  assert.ok(!out.includes("record-table-sort"), "and no button");
  assert.match(out, /<th scope="col">Title<\/th>/);
});

test("a sortable header carries a hidden button the island reveals", () => {
  const document = docOf({ from: "books", columns });
  const [title] = buttons(document)!;
  assert.ok(title!.hidden, "hidden before the island runs");
  assert.equal(title!.getAttribute("aria-label"), "Sort by Title");
  assert.match(html({ from: "books", columns }), /<th scope="col" data-field="title" data-kind="text" data-label="Title">/);
  activate(document as unknown as SortDocument);
  assert.equal(title!.hidden, false, "revealed once the island runs");
});

test("text sorts with the page language's collation, and empty values stay last", () => {
  const document = docOf({ from: "books", columns });
  activate(document as unknown as SortDocument);
  sortBy(document, 0);
  assert.deepEqual(ids(document), ["b", "e", "c", "a", "d"]);
  assert.equal(document.querySelector("thead th")!.getAttribute("aria-sort"), "ascending");
  assert.equal(document.querySelector(".record-table-status")!.textContent, "Sorted by Title, ascending.");
});

test("a second click reverses the order, and the empty value is still last", () => {
  const document = docOf({ from: "books", columns });
  activate(document as unknown as SortDocument);
  sortBy(document, 0);
  sortBy(document, 0);
  assert.deepEqual(ids(document), ["a", "c", "b", "e", "d"]);
  assert.equal(document.querySelector("thead th")!.getAttribute("aria-sort"), "descending");
  assert.equal(document.querySelectorAll("[aria-sort]").length, 1, "only the sorted column says so");
  assert.equal(document.querySelector(".record-table-status")!.textContent, "Sorted by Title, descending.");
});

test("an equal value keeps the order the server sent", () => {
  const document = docOf({ from: "books", columns });
  activate(document as unknown as SortDocument);
  sortBy(document, 0);
  assert.deepEqual(ids(document), ["b", "e", "c", "a", "d"], "b before e, as they came");
});

test("numbers compare as numbers, not as text", () => {
  const document = docOf({ from: "books", columns });
  activate(document as unknown as SortDocument);
  sortBy(document, 1);
  assert.deepEqual(ids(document), ["d", "b", "e", "a", "c"]);
});

test("dates compare as dates, and an unparseable one is empty", () => {
  const document = docOf({ from: "books", columns });
  activate(document as unknown as SortDocument);
  sortBy(document, 2);
  assert.deepEqual(ids(document), ["b", "e", "c", "a", "d"]);
});

test("a Persian page sorts its text by the Persian collation", () => {
  const document = docOf({ from: "books", columns }, "fa");
  activate(document as unknown as SortDocument);
  sortBy(document, 0);
  assert.deepEqual(ids(document), ["b", "e", "c", "a", "d"]);
});
