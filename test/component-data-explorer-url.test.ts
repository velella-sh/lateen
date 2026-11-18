// The explorer keeps its query, filters and sort in the address, using the search results
// contract's parameter names. The island replaces the address instead of pushing an entry, so a fast
// typist never builds a history to step back through, and back or forward puts the controls back.
// The same page without a script still renders its table and the GET form to the search page.
import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { renderToString } from "preact-render-to-string";
import type { ComponentProps, DataRecord, Page, Site } from "@velella/mizzen/contracts";
import dataExplorer from "../components/data-explorer/index.ts";
import {
  activate,
  DEBOUNCE_MS,
  FILTER_PARAM,
  ORDER_PARAM,
  QUERY_PARAM,
  SORT_PARAM,
  type ExplorerDocument,
  type ExplorerEnv,
} from "../components/data-explorer/client.ts";

const INDEX_URL = "/data/books.index.json";

const record = (id: string, fields: Record<string, unknown>): DataRecord =>
  ({ id, fields, position: { line: 1, column: 1 }, fieldPositions: {} }) as unknown as DataRecord;

const books = [
  record("b0", { title: "Book 0", shelf: "fiction", year: 2020 }),
  record("b1", { title: "Book 1", shelf: "fiction", year: 2020 }),
  record("b2", { title: "Book 2", shelf: "fiction", year: 2021 }),
  record("b3", { title: "Book 3", shelf: "history", year: 2021 }),
  record("b4", { title: "Book 4", shelf: "history", year: 2021 }),
  record("b5", { title: "Book 5", shelf: "reference", year: 2022 }),
];

const site = {
  config: { base: "" },
  nav: {},
  data: {},
  pages: books.map((book) => ({ url: `/books/${book.id}/`, record: { collection: "books", id: book.id } })),
  collections: { books: { name: "books", source: "books.yml", records: books } },
} as unknown as Site;

const page = { lang: "en", url: "/books/", frontMatter: {} } as unknown as Page;

const indexJson = JSON.stringify({
  collection: "books",
  columns: ["title", "shelf", "year", "url"],
  rows: books.map((book) => [book.fields.title, book.fields.shelf, book.fields.year, `/books/${book.id}/`]),
});

const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/** The static explorer in a document opened at `url`, with a fake fetch and a clock by hand. */
function setup(url = "https://example.test/books/") {
  const input = {
    props: { from: "books", columns: "title,shelf,year", filters: "shelf", sort: "title,year" },
    page,
    site,
    html: "",
  } as unknown as ComponentProps;
  const html = renderToString(dataExplorer(input) as never);
  const dom = new JSDOM(`<!doctype html><html lang="en"><body>${html}</body></html>`, { url });
  const document = dom.window.document;

  const calls: string[] = [];
  let pending: (() => void) | undefined;
  const env: ExplorerEnv = {
    async fetchText(requested) {
      calls.push(requested);
      if (requested !== INDEX_URL) throw new Error(`no file at ${requested}`);
      return indexJson;
    },
    schedule(listener, ms) {
      assert.equal(ms, DEBOUNCE_MS);
      pending = listener;
      return 1;
    },
    cancel() {
      pending = undefined;
    },
  };

  const flush = (): void => {
    const run = pending;
    pending = undefined;
    assert.ok(run !== undefined, "a query is waiting for the pause");
    run();
  };

  const island = document as unknown as ExplorerDocument;
  return { dom, document, env, calls, flush, html, island };
}

type Fixture = ReturnType<typeof setup>;

/** A few turns of the microtask and timer queues, so the fake fetch's promise lands. */
async function settle(): Promise<void> {
  for (let turn = 0; turn < 5; turn += 1) await tick();
}

const params = (dom: Fixture["dom"]): URLSearchParams => new URL(dom.window.location.href).searchParams;
const field = (document: Fixture["document"]): HTMLInputElement =>
  document.querySelector(".data-explorer-input") as unknown as HTMLInputElement;
const sortSelect = (document: Fixture["document"]): HTMLSelectElement =>
  document.querySelector(".data-explorer-sort-field") as unknown as HTMLSelectElement;
const box = (document: Fixture["document"], value: string): HTMLInputElement => {
  const input = document.querySelector(`[data-explorer-filters] input[value="${value}"]`);
  assert.ok(input !== null, `a "${value}" filter is drawn`);
  return input as unknown as HTMLInputElement;
};
const rows = (document: Fixture["document"]): Element[] => [...document.querySelectorAll("tbody tr")];
const titles = (document: Fixture["document"]): (string | null | undefined)[] =>
  rows(document).map((row) => row.querySelector("a")?.textContent);

function typeQuery(fixture: Fixture, text: string): void {
  const input = field(fixture.document);
  input.value = text;
  input.dispatchEvent(new fixture.dom.window.Event("input"));
}

function choose(fixture: Fixture, value: string, checked = true): void {
  const input = box(fixture.document, value);
  input.checked = checked;
  input.dispatchEvent(new fixture.dom.window.Event("change", { bubbles: true }));
}

test("an address restores the query, the filters and the sort", async () => {
  const fixture = setup(
    "https://example.test/books/?q=book&filter.shelf=history&sort=title&order=desc",
  );
  activate(fixture.island, fixture.env);
  await settle();

  assert.equal(field(fixture.document).value, "book");
  assert.equal(box(fixture.document, "history").checked, true);
  assert.equal(box(fixture.document, "fiction").checked, false);
  assert.equal(sortSelect(fixture.document).value, "title:descending");
  assert.deepEqual(titles(fixture.document), ["Book 4", "Book 3"]);

  // Reading the address is not a reason to rewrite it.
  assert.equal(params(fixture.dom).get(QUERY_PARAM), "book");
  assert.deepEqual(params(fixture.dom).getAll(`${FILTER_PARAM}shelf`), ["history"]);
  assert.equal(params(fixture.dom).get(SORT_PARAM), "title");
  assert.equal(params(fixture.dom).get(ORDER_PARAM), "desc");
});

test("typing, filtering and sorting rewrite the address without adding history entries", async () => {
  const fixture = setup();
  activate(fixture.island, fixture.env);
  field(fixture.document).focus();
  await settle();
  const entries = fixture.dom.window.history.length;

  typeQuery(fixture, "book");
  fixture.flush();
  assert.equal(params(fixture.dom).get(QUERY_PARAM), "book");
  assert.equal(fixture.dom.window.history.length, entries, "a pause replaces the address, never pushes");

  choose(fixture, "history");
  assert.deepEqual(params(fixture.dom).getAll(`${FILTER_PARAM}shelf`), ["history"]);

  const select = sortSelect(fixture.document);
  select.value = "year:descending";
  select.dispatchEvent(new fixture.dom.window.Event("change", { bubbles: true }));
  assert.equal(params(fixture.dom).get(SORT_PARAM), "year");
  assert.equal(params(fixture.dom).get(ORDER_PARAM), "desc");
  assert.equal(fixture.dom.window.history.length, entries);

  typeQuery(fixture, "");
  assert.equal(params(fixture.dom).get(QUERY_PARAM), null);
  assert.deepEqual(params(fixture.dom).getAll(`${FILTER_PARAM}shelf`), ["history"]);
  assert.equal(params(fixture.dom).get(SORT_PARAM), null);

  choose(fixture, "history", false);
  assert.equal(params(fixture.dom).get(`${FILTER_PARAM}shelf`), null);
  assert.equal(rows(fixture.document).length, books.length, "clearing brings the static rows back");
});

test("back and forward put the controls and the table back", async () => {
  const fixture = setup(
    "https://example.test/books/?q=book&filter.shelf=history&sort=title&order=desc",
  );
  activate(fixture.island, fixture.env);
  await settle();

  fixture.dom.window.history.pushState(null, "", "/books/?q=book&filter.shelf=fiction&sort=year&order=asc");
  fixture.dom.window.dispatchEvent(new fixture.dom.window.PopStateEvent("popstate"));
  await settle();
  assert.equal(field(fixture.document).value, "book");
  assert.equal(box(fixture.document, "fiction").checked, true);
  assert.equal(box(fixture.document, "history").checked, false);
  assert.equal(sortSelect(fixture.document).value, "year:ascending");
  assert.deepEqual(titles(fixture.document), ["Book 0", "Book 1", "Book 2"]);

  fixture.dom.window.history.back();
  await settle();
  assert.equal(field(fixture.document).value, "book");
  assert.equal(box(fixture.document, "history").checked, true);
  assert.equal(sortSelect(fixture.document).value, "title:descending");
  assert.deepEqual(titles(fixture.document), ["Book 4", "Book 3"]);
});

test("the same address reads without JavaScript, and the fallback form keeps the contract names", () => {
  const fixture = setup(
    "https://example.test/books/?q=book&filter.shelf=history&sort=title&order=desc",
  );
  // No island runs here: the page is exactly what the server wrote.
  assert.equal(field(fixture.document).value, "");
  assert.equal(rows(fixture.document).length, books.length, "the static table reads without a script");

  const form = fixture.document.querySelector("form");
  assert.ok(form, "the form is in the markup");
  assert.equal(form.getAttribute("action"), "/search/");
  assert.equal(form.querySelector('input[name="q"]')?.getAttribute("type"), "search");
  assert.equal(fixture.document.querySelector('input[name="filter.collection"]')?.getAttribute("value"), "books");
  const sortBox = fixture.document.querySelector("[data-explorer-sort]") as unknown as HTMLElement;
  const filtersBox = fixture.document.querySelector("[data-explorer-filters]") as unknown as HTMLElement;
  assert.equal(sortBox.hidden, true, "the sort control waits for the island");
  assert.equal(filtersBox.hidden, true, "the filter box waits for the island");

  assert.equal(QUERY_PARAM, "q");
  assert.equal(FILTER_PARAM, "filter.");
  assert.equal(SORT_PARAM, "sort");
  assert.equal(ORDER_PARAM, "order");
  assert.equal(params(fixture.dom).get(QUERY_PARAM), "book");
});
