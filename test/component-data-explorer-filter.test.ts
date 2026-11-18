import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { renderToString } from "preact-render-to-string";
import type { ComponentProps, DataRecord, Page, Site } from "@velella/mizzen/contracts";
import dataExplorer from "../components/data-explorer/index.ts";
import { activate, DEBOUNCE_MS, type ExplorerDocument, type ExplorerEnv } from "../components/data-explorer/client.ts";

const INDEX_URL = "/data/books.index.json";

const record = (id: string, fields: Record<string, unknown>): DataRecord =>
  ({ id, fields, position: { line: 1, column: 1 }, fieldPositions: {} }) as unknown as DataRecord;

const books = [
  record("b0", { title: "Book 0", shelf: "fiction", year: 2020, format: "paper" }),
  record("b1", { title: "Book 1", shelf: "fiction", year: 2020, format: "paper" }),
  record("b2", { title: "Book 2", shelf: "fiction", year: 2021, format: "paper" }),
  record("b3", { title: "Book 3", shelf: "history", year: 2021, format: "paper" }),
  record("b4", { title: "Book 4", shelf: "history", year: 2021, format: "paper" }),
  record("b5", { title: "Book 5", shelf: "reference", year: 2022, format: "paper" }),
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
  columns: ["title", "shelf", "year", "format", "url"],
  rows: books.map((book) => [
    book.fields.title,
    book.fields.shelf,
    book.fields.year,
    book.fields.format,
    `/books/${book.id}/`,
  ]),
});

const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/** The static explorer and a fake fetch with a clock the test runs by hand. */
function setup() {
  const input = {
    props: { from: "books", columns: "title,shelf,year", filters: "shelf,year,format" },
    page,
    site,
    html: "",
  } as unknown as ComponentProps;
  const html = renderToString(dataExplorer(input) as never);
  const dom = new JSDOM(`<!doctype html><html lang="en"><body>${html}</body></html>`);
  const document = dom.window.document;

  const calls: string[] = [];
  let pending: (() => void) | undefined;
  const env: ExplorerEnv = {
    async fetchText(url) {
      calls.push(url);
      if (url !== INDEX_URL) throw new Error(`no file at ${url}`);
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

  return { dom, document, env, calls, flush, html };
}

type Fixture = ReturnType<typeof setup>;

const island = (document: Fixture["document"]): ExplorerDocument => document as unknown as ExplorerDocument;

function typeQuery(document: Fixture["document"], dom: Fixture["dom"], text: string): void {
  const field = document.querySelector(".data-explorer-input") as unknown as {
    value: string;
    focus(): void;
    dispatchEvent(event: unknown): void;
  };
  field.focus();
  field.value = text;
  field.dispatchEvent(new dom.window.Event("input"));
}

const rows = (document: Fixture["document"]): Element[] => [...document.querySelectorAll("tbody tr")];
const status = (document: Fixture["document"]): string =>
  document.querySelector(".data-explorer-status")!.textContent ?? "";
const filters = (document: Fixture["document"]): HTMLElement =>
  document.querySelector("[data-explorer-filters]") as unknown as HTMLElement;
const chips = (document: Fixture["document"]): HTMLElement =>
  document.querySelector("[data-explorer-chips]") as unknown as HTMLElement;

/** The filter option whose value is `value`, as a checkbox. */
function option(document: Fixture["document"], value: string): HTMLInputElement {
  const input = document.querySelector(`[data-explorer-filters] input[value="${value}"]`);
  assert.ok(input !== null, `a "${value}" filter is drawn`);
  return input as unknown as HTMLInputElement;
}

/** Sets an option and tells the explorer, the way a reader click does. */
function choose(document: Fixture["document"], dom: Fixture["dom"], value: string, checked = true): void {
  const input = option(document, value);
  input.checked = checked;
  input.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
}

const tally = (document: Fixture["document"], value: string): string =>
  option(document, value).parentElement!.querySelector(".data-explorer-filter-count")!.textContent ?? "";

test("without a script the filters stay hidden and hold no controls", () => {
  const { html } = setup();
  assert.match(html, /data-explorer-filters/);
  assert.match(html, /data-explorer-chips/);
  assert.doesNotMatch(html, /data-explorer-filter-option/);
  const dom = new JSDOM(`<!doctype html><html lang="en"><body>${html}</body></html>`);
  const box = dom.window.document.querySelector("[data-explorer-filters]") as unknown as HTMLElement;
  const chipBox = dom.window.document.querySelector("[data-explorer-chips]") as unknown as HTMLElement;
  assert.equal(box.hidden, true);
  assert.equal(chipBox.hidden, true);
});

test("the first focus draws one field per filter field and skips the field with one value", async () => {
  const { document, env } = setup();
  activate(island(document), env);
  const input = document.querySelector(".data-explorer-input") as unknown as HTMLInputElement;
  input.focus();
  await tick();
  await tick();

  assert.equal(filters(document).hidden, false);
  const legends = [...document.querySelectorAll("[data-explorer-filters] legend")].map((legend) => legend.textContent);
  assert.deepEqual(legends, ["Filter by shelf", "Filter by year"]);
  assert.equal(document.querySelectorAll("[data-explorer-filters] input").length, 6);
  assert.equal(chips(document).hidden, true);
  assert.deepEqual([tally(document, "fiction"), tally(document, "history"), tally(document, "reference")], [
    "(3)",
    "(2)",
    "(1)",
  ]);
});

test("one filter narrows the rows and the counts of the other fields", async () => {
  const { dom, document, env, flush } = setup();
  activate(island(document), env);
  typeQuery(document, dom, "book");
  flush();
  await tick();
  await tick();

  choose(document, dom, "fiction");
  assert.equal(rows(document).length, 3);
  assert.equal(status(document), "3 results.");
  assert.equal(chips(document).hidden, false);
  assert.equal(document.querySelectorAll(".data-explorer-chip").length, 1);
  assert.equal(document.querySelector(".data-explorer-chip")!.getAttribute("aria-label"), "Remove shelf: fiction");
  assert.deepEqual([tally(document, "2020"), tally(document, "2021"), tally(document, "2022")], ["(2)", "(1)", "(0)"]);
});

test("two filters combine, and removing a chip brings the rows back", async () => {
  const { dom, document, env, flush } = setup();
  activate(island(document), env);
  typeQuery(document, dom, "book");
  flush();
  await tick();
  await tick();

  choose(document, dom, "fiction");
  choose(document, dom, "2021");
  assert.equal(rows(document).length, 1);
  assert.equal(rows(document)[0]!.querySelector("a")!.textContent, "Book 2");
  assert.equal(document.querySelectorAll(".data-explorer-chip").length, 2);
  assert.deepEqual([tally(document, "fiction"), tally(document, "history"), tally(document, "reference")], [
    "(1)",
    "(2)",
    "(0)",
  ]);

  const chip = document.querySelector(".data-explorer-chip") as unknown as { dispatchEvent(event: unknown): void };
  chip.dispatchEvent(new dom.window.Event("click", { bubbles: true }));
  assert.equal(option(document, "fiction").checked, false);
  assert.equal(rows(document).length, 3, "only the year filter is left");
  assert.equal(document.querySelectorAll(".data-explorer-chip").length, 1);
  assert.match(document.querySelector(".data-explorer-chip")!.textContent ?? "", /^year: 2021/);
});

test("a filter and a query both apply, and a query with no match names itself", async () => {
  const { dom, document, env, flush } = setup();
  activate(island(document), env);
  typeQuery(document, dom, "book 1");
  flush();
  await tick();
  await tick();

  choose(document, dom, "fiction");
  assert.equal(rows(document).length, 1);
  assert.equal(rows(document)[0]!.querySelector("a")!.textContent, "Book 1");

  choose(document, dom, "fiction", false);
  choose(document, dom, "reference");
  typeQuery(document, dom, "book 1");
  flush();
  assert.equal(rows(document).length, 0);
  assert.equal(document.querySelector(".data-explorer-empty")!.textContent, "No results for “book 1”.");
});

test("filters that match nothing say so without a query, and clearing the query keeps them", async () => {
  const { dom, document, env, flush } = setup();
  activate(island(document), env);
  typeQuery(document, dom, "book");
  flush();
  await tick();
  await tick();

  choose(document, dom, "reference");
  choose(document, dom, "2020");
  assert.equal(rows(document).length, 0);
  assert.equal(document.querySelector(".data-explorer-empty")!.textContent, "No results for “book”.");

  typeQuery(document, dom, "");
  assert.equal(rows(document).length, 0, "the filters are still on");
  assert.equal(document.querySelector(".data-explorer-empty")!.textContent, "No rows match the filters.");
  assert.equal(document.querySelectorAll(".data-explorer-chip").length, 2);
});
