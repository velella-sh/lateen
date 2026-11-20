import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { renderToString } from "preact-render-to-string";
import type { ComponentProps, DataRecord, Page, Site } from "@velella/mizzen/contracts";
import dataExplorer, { PAGE_SIZE } from "../components/data-explorer/index.ts";
import {
  activate,
  DEBOUNCE_MS,
  type ExplorerDocument,
  type ExplorerEnv,
} from "../components/data-explorer/client.ts";

const INDEX_URL = "/data/books.index.json";
const COUNT = 60;

const record = (id: string, fields: Record<string, unknown>): DataRecord =>
  ({ id, fields, position: { line: 1, column: 1 }, fieldPositions: {} }) as unknown as DataRecord;

const books = Array.from({ length: COUNT }, (_, index) =>
  record(`b${index}`, { title: `Book ${index}`, pages: index }),
);

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
  columns: ["title", "pages", "url"],
  rows: books.map((book, at) => [book.fields.title, at, `/books/${book.id}/`]),
});

const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/** The static explorer and a fake fetch with a clock the test runs by hand. */
function setup() {
  const input = { props: { from: "books", columns: "title,pages" }, page, site, html: "" } as unknown as ComponentProps;
  const html = renderToString(dataExplorer(input) as never);
  const dom = new JSDOM(`<!doctype html><html lang="en"><body>${html}</body></html>`, { url: "https://example.com/books/" });
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

  return { dom, document, env, calls, flush, waiting: () => pending !== undefined };
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
const empty = (document: Fixture["document"]): HTMLElement =>
  document.querySelector(".data-explorer-empty") as unknown as HTMLElement;
const more = (document: Fixture["document"]): HTMLButtonElement =>
  document.querySelector(".data-explorer-more") as unknown as HTMLButtonElement;

test("typing waits for the pause, then replaces the first rows with the matches", async () => {
  const { dom, document, env, calls, flush, waiting } = setup();
  activate(island(document), env);

  typeQuery(document, dom, "book 5");
  typeQuery(document, dom, "book 5");
  assert.equal(calls.length, 1, "the index is read once, on focus");
  assert.ok(waiting(), "the query waits for the pause");

  flush();
  await tick();
  await tick();

  assert.deepEqual(calls, [INDEX_URL], "one load for the whole burst");
  assert.equal(rows(document).length, 11);
  assert.equal(status(document), "11 results.");
  const first = document.querySelector("tbody tr a")!;
  assert.equal(first.getAttribute("href"), "/books/b5/");
  assert.equal(first.textContent, "Book 5");
  assert.equal(empty(document).hidden, true);
  assert.equal(more(document).hidden, true);
});

test("clearing puts the static rows back and says nothing", async () => {
  const { dom, document, env, calls, flush } = setup();
  activate(island(document), env);

  typeQuery(document, dom, "book 5");
  flush();
  await tick();
  await tick();
  assert.equal(rows(document).length, 11);

  typeQuery(document, dom, "");
  assert.equal(rows(document).length, PAGE_SIZE, "the first page returns");
  assert.equal(status(document), "");
  assert.equal(empty(document).hidden, true);
  assert.equal(more(document).hidden, true);
  assert.equal(calls.length, 1, "clearing reads no index again");
});

test("no results names the query and announces zero", async () => {
  const { dom, document, env, flush } = setup();
  activate(island(document), env);

  typeQuery(document, dom, "zzz");
  flush();
  await tick();
  await tick();

  assert.equal(rows(document).length, 0);
  assert.equal(status(document), "0 results.");
  assert.equal(empty(document).hidden, false);
  assert.equal(empty(document).textContent, "No results for “zzz”.");
  assert.equal((document.querySelector(".table-scroll") as unknown as { hidden: boolean }).hidden, true, "the empty table goes away");
});

test("fifty rows show first, and the button reveals the rest", async () => {
  const { dom, document, env, flush } = setup();
  activate(island(document), env);

  typeQuery(document, dom, "book");
  flush();
  await tick();
  await tick();

  assert.equal(rows(document).length, PAGE_SIZE);
  assert.equal(status(document), "60 results.");
  assert.equal(more(document).hidden, false);
  assert.equal(more(document).textContent, "Show more");

  more(document).click();
  assert.equal(rows(document).length, COUNT);
  assert.equal(more(document).hidden, true);
});

test("scrolling a loaded list reads no index and replaces no rows", async () => {
  const { dom, document, env, calls, flush, waiting } = setup();
  activate(island(document), env);

  typeQuery(document, dom, "book 5");
  flush();
  await tick();
  await tick();

  assert.equal(calls.length, 1, "the index is read once, on focus");
  const before = rows(document);
  assert.equal(before.length, 11);
  const shown = status(document);

  const scroll = (target: { dispatchEvent(event: unknown): boolean }): void => {
    target.dispatchEvent(new dom.window.Event("scroll", { bubbles: true }));
  };
  scroll(document.querySelector(".table-scroll")!);
  scroll(document);
  scroll(dom.window);
  (dom.window as unknown as { scrollY: number }).scrollY = 500;

  await tick();

  assert.equal(calls.length, 1, "scrolling reads no index");
  const after = rows(document);
  assert.equal(after.length, before.length, "no row appears or goes");
  after.forEach((row, at) => assert.equal(row, before[at], `row ${at} is the same node`));
  assert.equal(status(document), shown, "the count stays put");
  assert.equal(waiting(), false, "a scroll schedules no query");
});

test("a later keystroke replaces the query that was waiting", async () => {
  const { dom, document, env, calls, flush } = setup();
  activate(island(document), env);

  typeQuery(document, dom, "book 5");
  typeQuery(document, dom, "book 9");
  flush();
  await tick();
  await tick();

  assert.equal(calls.length, 1);
  assert.equal(rows(document).length, 1);
  assert.equal(document.querySelector("tbody tr a")!.getAttribute("href"), "/books/b9/");
});
