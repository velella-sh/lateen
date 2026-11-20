import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { renderToString } from "preact-render-to-string";
import type { ComponentProps, DataRecord, Page, Site } from "@velella/mizzen/contracts";
import recordTable, { SORTABLE_CLASS } from "../components/record-table/index.ts";
import { activate, type SortDocument } from "../components/record-table/client.ts";
import { dataRecord } from "./helpers/record.ts";

const record = (id: string, fields: Record<string, unknown>): DataRecord => dataRecord({ id, fields });

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

function docOf(props: Record<string, unknown>, lang = "en", dir = "ltr") {
  const document = new JSDOM(`<!doctype html><html lang="${lang}" dir="${dir}"><body>${html(props)}</body></html>`, {
    url: "https://example.com/books/",
  }).window.document;
  return document;
}

const ids = (document: ReturnType<typeof docOf>): string[] =>
  [...document.querySelectorAll("tbody tr")].map(
    (row) => row.querySelector("a")?.getAttribute("href")?.replace("/books/", "").replace("/", "") ?? "",
  );

const buttons = (document: ReturnType<typeof docOf>): HTMLElement[] =>
  [...document.querySelectorAll(".record-table-sort")].map((node) => node as HTMLElement);

const headers = (document: ReturnType<typeof docOf>): HTMLElement[] =>
  [...document.querySelectorAll("thead th")].map((node) => node as HTMLElement);

const arrow = (document: ReturnType<typeof docOf>, at: number): HTMLElement =>
  headers(document)[at]!.querySelector(".record-table-sort-icon") as HTMLElement;

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
  assert.equal(headers(document)[0]!.getAttribute("aria-sort"), "none", "unsorted until the reader asks");
  assert.equal(arrow(document, 0).getAttribute("aria-hidden"), "true", "the arrow is decoration");
  assert.equal(arrow(document, 0).textContent, "↕");
  assert.match(
    html({ from: "books", columns }),
    /<th scope="col" aria-sort="none" data-field="title" data-kind="text" data-label="Title">/,
  );
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
  assert.equal(
    document.querySelectorAll('[aria-sort="ascending"], [aria-sort="descending"]').length,
    1,
    "only the sorted column says so",
  );
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

test("every sortable header starts unsorted, and loading the page keeps the sent order", () => {
  const server = docOf({ from: "books", columns });
  assert.deepEqual(headers(server).map((th) => th.getAttribute("aria-sort")), ["none", "none", "none"]);
  assert.deepEqual(ids(server), ["a", "b", "c", "d", "e"], "no script leaves the rows as the server sent them");
  assert.ok(buttons(server).every((button) => button.hidden), "and no control that would do nothing");

  const document = docOf({ from: "books", columns });
  activate(document as unknown as SortDocument);
  assert.deepEqual(headers(document).map((th) => th.getAttribute("aria-sort")), ["none", "none", "none"]);
  assert.deepEqual(ids(document), ["a", "b", "c", "d", "e"], "activating the island sorts nothing by itself");
  assert.deepEqual(
    headers(document).map((_, at) => arrow(document, at).textContent),
    ["↕", "↕", "↕"],
  );
});

test("aria-sort and the arrow name the one sorted column and its direction", () => {
  const document = docOf({ from: "books", columns });
  activate(document as unknown as SortDocument);

  sortBy(document, 0);
  assert.deepEqual(headers(document).map((th) => th.getAttribute("aria-sort")), ["ascending", "none", "none"]);
  assert.deepEqual(headers(document).map((_, at) => arrow(document, at).textContent), ["↑", "↕", "↕"]);

  sortBy(document, 1);
  assert.deepEqual(headers(document).map((th) => th.getAttribute("aria-sort")), ["none", "ascending", "none"]);
  assert.deepEqual(headers(document).map((_, at) => arrow(document, at).textContent), ["↕", "↑", "↕"]);

  sortBy(document, 1);
  assert.deepEqual(headers(document).map((th) => th.getAttribute("aria-sort")), ["none", "descending", "none"]);
  assert.deepEqual(headers(document).map((_, at) => arrow(document, at).textContent), ["↕", "↓", "↕"]);
});

test("the sort control is a real button, reachable and operable from the keyboard", () => {
  const document = docOf({ from: "books", columns });
  activate(document as unknown as SortDocument);
  const button = buttons(document)[0]!;
  assert.equal(button.tagName, "BUTTON");
  assert.equal(button.getAttribute("type"), "button", "Enter and Space activate it natively");
  assert.equal(button.tabIndex, 0, "it sits in the tab order");
  button.focus();
  assert.equal(document.activeElement, button);

  // A native button turns Enter and Space into a click; dispatching it is the keyboard path.
  button.dispatchEvent(new (document.defaultView as Window & typeof globalThis).Event("click"));
  assert.equal(headers(document)[0]!.getAttribute("aria-sort"), "ascending");
});

test("RTL keeps the label first and the same ascending arrow", () => {
  const document = docOf({ from: "books", columns }, "fa", "rtl");
  assert.equal(document.documentElement.getAttribute("dir"), "rtl");
  activate(document as unknown as SortDocument);
  const title = headers(document)[0]!;
  assert.equal(title.firstChild?.textContent, "Title", "the label stays before the control");
  assert.equal(arrow(document, 0).textContent, "↕");

  sortBy(document, 0);
  assert.deepEqual(ids(document), ["b", "e", "c", "a", "d"]);
  assert.equal(title.getAttribute("aria-sort"), "ascending");
  assert.equal(arrow(document, 0).textContent, "↑", "ascending points up in RTL too");
  sortBy(document, 0);
  assert.equal(title.getAttribute("aria-sort"), "descending");
  assert.equal(arrow(document, 0).textContent, "↓");
});

test("clearing the address returns every header to none", () => {
  const document = docOf({ from: "books", columns });
  activate(document as unknown as SortDocument);
  sortBy(document, 1);
  assert.equal(headers(document)[1]!.getAttribute("aria-sort"), "ascending");

  const view = document.defaultView as Window & typeof globalThis;
  view.history.replaceState(null, "", "/books/");
  view.dispatchEvent(new view.Event("popstate"));
  assert.deepEqual(headers(document).map((th) => th.getAttribute("aria-sort")), ["none", "none", "none"]);
  assert.deepEqual(headers(document).map((_, at) => arrow(document, at).textContent), ["↕", "↕", "↕"]);
  assert.deepEqual(ids(document), ["a", "b", "c", "d", "e"], "and the sent order comes back");
});
