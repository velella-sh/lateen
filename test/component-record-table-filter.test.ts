import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { renderToString } from "preact-render-to-string";
import type { ComponentProps, DataRecord, Page, Site } from "@velella/mizzen/contracts";
import recordTable, { CLEAR_FILTERS_CLASS, FILTERS_CLASS } from "../components/record-table/index.ts";
import {
  EMPTY_FILTERS_SELECTOR,
  FILTERS_SELECTOR,
  SELECT_FILTER_SELECTOR,
  TEXT_FILTER_SELECTOR,
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

function html(props: Record<string, unknown>, lang = "en"): string {
  const input = { props, page: { ...page, lang }, site, html: "" } as unknown as ComponentProps;
  return renderToString(recordTable(input) as never);
}

function docOf(props: Record<string, unknown>, lang = "en"): Document {
  const document = new JSDOM(`<!doctype html><html lang="${lang}"><body>${html(props, lang)}</body></html>`, {
    url: "https://example.com/books/",
  }).window
    .document;
  activate(document as unknown as SortDocument);
  return document;
}

const rows = (document: Document): HTMLElement[] =>
  [...document.querySelectorAll("tbody tr")].map((row) => row as HTMLElement);

const shown = (document: Document): string[] =>
  rows(document)
    .filter((row) => !row.hidden)
    .map((row) => row.querySelector("a")?.textContent ?? "");

const status = (document: Document): string =>
  document.querySelector(".record-table-status")?.textContent ?? "";

const empty = (document: Document): HTMLElement =>
  document.querySelector(EMPTY_FILTERS_SELECTOR) as HTMLElement;

const selects = (document: Document): HTMLSelectElement[] =>
  [...document.querySelectorAll(SELECT_FILTER_SELECTOR)].map((node) => node as HTMLSelectElement);

function type(document: Document, value: string): void {
  const input = document.querySelector(TEXT_FILTER_SELECTOR) as HTMLInputElement;
  input.value = value;
  input.dispatchEvent(new (document.defaultView as Window & typeof globalThis).Event("input", { bubbles: true }));
}

function choose(document: Document, at: number, value: string): void {
  const select = selects(document)[at]!;
  select.value = value;
  select.dispatchEvent(new (document.defaultView as Window & typeof globalThis).Event("change", { bubbles: true }));
}

test("a table gets a text filter and one select per marked column, revealed by the island", () => {
  const out = html({ from: "books", columns });
  assert.match(out, new RegExp(`<form class="${FILTERS_CLASS}" role="search" hidden`));
  assert.match(out, /<input class="record-table-filter-text" type="search"\/>/);
  assert.equal((out.match(/record-table-filter-select/g) ?? []).length, 2, "only the two marked columns");
  assert.match(out, /<option value>All<\/option>/);
  assert.match(out, /<option value="Beta">Beta<\/option>/);

  const document = docOf({ from: "books", columns });
  assert.equal((document.querySelector(FILTERS_SELECTOR) as HTMLElement).hidden, false);
});

test("a paginated table has no filter controls", () => {
  const out = html({ from: "books", columns, paginated: true });
  assert.ok(!out.includes(FILTERS_CLASS), "no form");
  assert.ok(!out.includes(SELECT_FILTER_SELECTOR.slice(1)), "no select");
  assert.ok(!out.includes("record-table-filter-text"), "no text box");
});

test("the text filter matches any visible cell and announces how many rows remain", () => {
  const document = docOf({ from: "books", columns });
  assert.deepEqual(shown(document), ["Alpha", "Beta", "Gamma", "Delta", "Beta"]);

  type(document, "beta");
  assert.deepEqual(shown(document), ["Beta", "Beta"]);
  assert.equal(status(document), "2 of 5 rows shown.");

  type(document, "2026");
  assert.deepEqual(shown(document), ["Alpha", "Beta", "Gamma", "Delta", "Beta"], "a date cell matches its text");
});

test("one select keeps the rows whose column carries its value", () => {
  const document = docOf({ from: "books", columns });
  choose(document, 1, "120");
  assert.deepEqual(shown(document), ["Alpha", "Gamma"]);
  assert.equal(status(document), "2 of 5 rows shown.");
});

test("two selects together keep only the rows that match both", () => {
  const document = docOf({ from: "books", columns });
  choose(document, 0, "Beta");
  choose(document, 1, "80");
  assert.deepEqual(shown(document), ["Beta"]);
  assert.equal(status(document), "1 of 5 rows shown.");

  type(document, "nothing");
  assert.deepEqual(shown(document), []);
  assert.equal(status(document), "0 of 5 rows shown.");
});

test("the empty state appears when nothing matches, and its button clears every filter", () => {
  const document = docOf({ from: "books", columns });
  assert.equal(empty(document).hidden, true, "hidden while all rows show");

  choose(document, 0, "Beta");
  type(document, "nothing");
  assert.equal(empty(document).hidden, false);
  assert.match(empty(document).textContent ?? "", /No rows match the filters\./);

  (document.querySelector(`.${CLEAR_FILTERS_CLASS}`) as HTMLElement).click();
  assert.deepEqual(shown(document), ["Alpha", "Beta", "Gamma", "Delta", "Beta"]);
  assert.equal(empty(document).hidden, true);
  assert.equal((document.querySelector(TEXT_FILTER_SELECTOR) as HTMLInputElement).value, "");
  assert.equal(selects(document)[0]!.value, "");
  assert.equal(status(document), "5 of 5 rows shown.");
});

test("the count message is written in the page's language", () => {
  const cases: [string, string][] = [
    ["en", "2 of 5 rows shown."],
    ["fa", "۲ از ۵ سطر نمایش داده می‌شود."],
    ["ar", "عرض 2 من 5 صفًا."],
  ];
  for (const [lang, expected] of cases) {
    const document = docOf({ from: "books", columns }, lang);
    type(document, "beta");
    assert.equal(status(document), expected, lang);
  }
});
