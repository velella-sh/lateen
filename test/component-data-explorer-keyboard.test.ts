// The explorer's keyboard: the field keeps focus and moves the active result with the arrow keys,
// Enter opens it, Escape clears the query, and Tab stays the browser's to keep. The ARIA state moves
// with the mark: `aria-activedescendant` only names a row while there are matches, and
// `aria-expanded` follows the list.
import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { renderToString } from "preact-render-to-string";
import type { ComponentProps, DataRecord, Page, Site } from "@velella/mizzen/contracts";
import dataExplorer, { PAGE_SIZE } from "../components/data-explorer/index.ts";
import {
  activate,
  ACTIVE_ROW_CLASS,
  DEBOUNCE_MS,
  OPTION_ID_PREFIX,
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
  const dom = new JSDOM(`<!doctype html><html lang="en"><body>${html}</body></html>`, {
    url: "https://example.com/books/",
  });
  const document = dom.window.document;

  let pending: (() => void) | undefined;
  const env: ExplorerEnv = {
    async fetchText(url) {
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

  activate(document as unknown as ExplorerDocument, env);

  const flush = (): void => {
    const run = pending;
    pending = undefined;
    assert.ok(run !== undefined, "a query is waiting for the pause");
    run();
  };

  return { dom, document, flush };
}

type Fixture = ReturnType<typeof setup>;

const field = (document: Fixture["document"]): HTMLInputElement =>
  document.querySelector(".data-explorer-input") as HTMLInputElement;

const rows = (document: Fixture["document"]): Element[] => [...document.querySelectorAll("tbody tr")];

const activeRow = (document: Fixture["document"]): Element | null =>
  document.querySelector(`.${ACTIVE_ROW_CLASS}`);

const optionElement = (document: Fixture["document"]): boolean =>
  document.querySelector(`[id^="${OPTION_ID_PREFIX}"]`) !== null;

/** Types a query and waits for the debounce and the first load to settle. */
async function search(fixture: Fixture, text: string): Promise<void> {
  const { document, dom, flush } = fixture;
  const query = field(document);
  query.focus();
  query.value = text;
  query.dispatchEvent(new dom.window.Event("input"));
  flush();
  await tick();
  await tick();
}

/** Presses a key in the field and returns the event, so the test can see if the browser kept it. */
function press(fixture: Fixture, key: string): KeyboardEvent {
  const { document, dom } = fixture;
  const query = field(document);
  query.focus();
  const event = new dom.window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
  query.dispatchEvent(event);
  return event;
}

test("the field is the results' combobox and starts collapsed", () => {
  const fixture = setup();
  const query = field(fixture.document);

  assert.equal(query.getAttribute("role"), "combobox");
  assert.equal(query.getAttribute("aria-expanded"), "false");
  assert.equal(query.getAttribute("aria-activedescendant"), null, "nothing is active before a query");
  assert.equal(optionElement(fixture.document), false, "the static rows are not options");
});

test("the arrow keys move the active row from the field, wrapping at the ends", async () => {
  const fixture = setup();
  const { document } = fixture;
  await search(fixture, "book 5");
  const drawn = rows(document);
  assert.equal(drawn.length, 11);

  assert.equal(press(fixture, "ArrowDown").defaultPrevented, true);
  assert.equal(document.activeElement, field(document), "focus stays in the field");
  assert.equal(activeRow(document), drawn[0]);
  assert.equal(drawn[0]!.id, `${OPTION_ID_PREFIX}1`);
  assert.equal(drawn[0]!.getAttribute("aria-selected"), "true");
  assert.equal(field(document).getAttribute("aria-activedescendant"), drawn[0]!.id);
  assert.equal(field(document).getAttribute("aria-expanded"), "true");

  press(fixture, "ArrowDown");
  assert.equal(activeRow(document), drawn[1]);
  assert.equal(drawn[0]!.getAttribute("aria-selected"), null, "only one row is active");
  assert.equal(field(document).getAttribute("aria-activedescendant"), drawn[1]!.id);

  press(fixture, "ArrowUp");
  assert.equal(activeRow(document), drawn[0]);

  press(fixture, "ArrowUp");
  assert.equal(activeRow(document), drawn[10], "up from the first wraps to the last");

  press(fixture, "ArrowDown");
  assert.equal(activeRow(document), drawn[0], "down from the last wraps to the first");
  assert.equal(field(document).getAttribute("aria-activedescendant"), drawn[0]!.id);
});

test("Enter opens the active result, or the first when nothing is active", async () => {
  const fixture = setup();
  const { document, dom } = fixture;
  await search(fixture, "book 5");

  const opened: string[] = [];
  for (const link of document.querySelectorAll("tbody tr a")) {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      opened.push(link.getAttribute("href") ?? "");
    });
  }

  const first = press(fixture, "Enter");
  assert.equal(first.defaultPrevented, true);
  assert.deepEqual(opened, ["/books/b5/"], "no active row opens the first");

  press(fixture, "ArrowDown");
  press(fixture, "ArrowDown");
  press(fixture, "Enter");
  assert.deepEqual(opened, ["/books/b5/", "/books/b50/"], "the active row is the one Enter opens");
  // Enter opens the row's link; the address keeps the query so a shared link restores the view.
  assert.equal(dom.window.location.href, "https://example.com/books/?q=book+5");
});

test("Escape clears the field, the active row, and puts the static rows back", async () => {
  const fixture = setup();
  const { document } = fixture;
  await search(fixture, "book 5");
  press(fixture, "ArrowDown");
  assert.equal(activeRow(document), rows(document)[0]);

  const escape = press(fixture, "Escape");
  assert.equal(escape.defaultPrevented, true);
  assert.equal(field(document).value, "");
  assert.equal(rows(document).length, PAGE_SIZE, "the first page returns");
  assert.equal(rows(document)[0]!.querySelector("a")!.textContent, "Book 0");
  assert.equal(activeRow(document), null);
  assert.equal(field(document).getAttribute("aria-activedescendant"), null);
  assert.equal(field(document).getAttribute("aria-expanded"), "false");
});

test("Escape on an empty field does nothing", () => {
  const fixture = setup();
  const { document } = fixture;

  const escape = press(fixture, "Escape");
  assert.equal(escape.defaultPrevented, false, "the browser keeps a key the field cannot use");
  assert.equal(field(document).value, "");
  assert.equal(rows(document).length, PAGE_SIZE);
  assert.equal(field(document).getAttribute("aria-activedescendant"), null);
});

test("no matches leave nothing active and the field collapsed", async () => {
  const fixture = setup();
  const { document } = fixture;
  await search(fixture, "zzz");
  assert.equal(rows(document).length, 0);

  assert.equal(field(document).getAttribute("aria-expanded"), "false");
  assert.equal(field(document).getAttribute("aria-activedescendant"), null);
  assert.equal(press(fixture, "ArrowDown").defaultPrevented, false, "there is no list to move through");
  assert.equal(press(fixture, "ArrowUp").defaultPrevented, false);
  assert.equal(press(fixture, "Enter").defaultPrevented, false, "Enter still submits the form");
});

test("a new query drops the active row and keeps the ARIA state in step", async () => {
  const fixture = setup();
  const { document } = fixture;
  await search(fixture, "book 5");
  press(fixture, "ArrowDown");
  press(fixture, "ArrowDown");
  assert.equal(field(document).getAttribute("aria-activedescendant"), `${OPTION_ID_PREFIX}2`);

  await search(fixture, "book 6");
  assert.equal(activeRow(document), null, "the old row is gone, so the mark goes too");
  assert.equal(field(document).getAttribute("aria-activedescendant"), null);
  assert.equal(field(document).getAttribute("aria-expanded"), "true", "the new list is open");

  await search(fixture, "zzz");
  assert.equal(field(document).getAttribute("aria-expanded"), "false");
  assert.equal(field(document).getAttribute("aria-activedescendant"), null);
});

test("Tab is not trapped", async () => {
  const fixture = setup();
  const { document } = fixture;
  await search(fixture, "book 5");
  press(fixture, "ArrowDown");

  assert.equal(press(fixture, "Tab").defaultPrevented, false, "Tab stays the browser's key");
  assert.equal(field(document).getAttribute("aria-activedescendant"), `${OPTION_ID_PREFIX}1`);
});
