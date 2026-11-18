// The explorer's sort control: relevance first, every field named in `sort` in both directions, the
// shared record-table rules (empty last, kinds respected), and a return to relevance on a new query.
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
  record("a", { title: "Beta", pages: 30, published: "2024-05-01" }),
  record("b", { title: "Alpha", pages: 10, published: "2025-01-01" }),
  record("c", { title: "Gamma", pages: 20, published: "2023-09-01" }),
  record("d", { title: "Delta", pages: 10 }),
  record("e", { title: "Epsilon", published: "2024-01-01" }),
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
  columns: ["title", "pages", "published", "url"],
  rows: books.map((book) => [
    book.fields.title,
    book.fields.pages ?? null,
    book.fields.published ?? null,
    `/books/${book.id}/`,
  ]),
});

const columns = JSON.stringify([
  { field: "title", label: "Title" },
  { field: "pages", label: "Pages", kind: "number" },
  { field: "published", label: "Published", kind: "date" },
]);

const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

function setup(sort = "title,pages,published") {
  const input = {
    props: { from: "books", columns, sort },
    page,
    site,
    html: "",
  } as unknown as ComponentProps;
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
  return { dom, document, html, flush: () => pending?.() };
}

type Fixture = ReturnType<typeof setup>;

const titles = (document: Fixture["document"]): string[] =>
  [...document.querySelectorAll("tbody tr")].map(
    (row) => row.querySelector("td a, td")?.textContent ?? "",
  );

const select = (document: Fixture["document"]): HTMLSelectElement =>
  document.querySelector(".data-explorer-sort-field") as HTMLSelectElement;

const wrapper = (document: Fixture["document"]): HTMLElement =>
  document.querySelector("[data-explorer-sort]") as HTMLElement;

/** Loads the index the way a reader's first focus does. */
async function load(document: Fixture["document"]): Promise<void> {
  (document.querySelector(".data-explorer-input") as HTMLInputElement).focus();
  await tick();
}

/** Picks a sort option the way the select's change event does. */
function sortBy(document: Fixture["document"], value: string): void {
  const field = select(document);
  field.value = value;
  field.dispatchEvent(new document.defaultView!.Event("change", { bubbles: true }));
}

test("without a script the sort control stays hidden and holds no options", () => {
  const { html } = setup();
  assert.match(html, /class="data-explorer-sort" data-explorer-sort hidden/);
  assert.match(html, /<label class="data-explorer-sort-label" for="data-explorer-sort">Sort by<\/label>/);
  assert.match(html, /<select class="data-explorer-sort-field" id="data-explorer-sort" data-explorer-sort-field><\/select>/);
});

test("no sort prop means no sort control", () => {
  const { html } = setup("");
  assert.doesNotMatch(html, /data-explorer-sort/);
});

test("the control shows relevance and both directions of every named field after the index loads", async () => {
  const { document } = setup();
  assert.equal(wrapper(document).hidden, true);

  await load(document);

  assert.equal(wrapper(document).hidden, false);
  assert.deepEqual(
    [...select(document).options].map((option) => option.textContent),
    [
      "Relevance",
      "Title — ascending",
      "Title — descending",
      "Pages — ascending",
      "Pages — descending",
      "Published — ascending",
      "Published — descending",
    ],
  );
  assert.equal(select(document).value, "");
  assert.deepEqual(titles(document), ["Beta", "Alpha", "Gamma", "Delta", "Epsilon"]);
});

test("numbers sort by value with empty values last in either direction", async () => {
  const { document } = setup();
  await load(document);

  sortBy(document, "pages:ascending");
  assert.deepEqual(titles(document), ["Alpha", "Delta", "Gamma", "Beta", "Epsilon"]);

  sortBy(document, "pages:descending");
  assert.deepEqual(titles(document), ["Beta", "Gamma", "Alpha", "Delta", "Epsilon"]);
});

test("dates sort by their day with empty values last", async () => {
  const { document } = setup();
  await load(document);

  sortBy(document, "published:ascending");
  assert.deepEqual(titles(document), ["Gamma", "Epsilon", "Beta", "Alpha", "Delta"]);

  sortBy(document, "published:descending");
  assert.deepEqual(titles(document), ["Alpha", "Beta", "Epsilon", "Gamma", "Delta"]);
});

test("text sorts in the page language and a new query returns to relevance", async () => {
  const { document, flush } = setup();
  await load(document);

  sortBy(document, "title:ascending");
  assert.deepEqual(titles(document), ["Alpha", "Beta", "Delta", "Epsilon", "Gamma"]);

  const field = document.querySelector(".data-explorer-input") as HTMLInputElement;
  field.value = "a";
  field.dispatchEvent(new document.defaultView!.Event("input", { bubbles: true }));

  assert.equal(select(document).value, "", "the next query starts from relevance");
  flush();
  assert.deepEqual(titles(document), ["Alpha"]);
});
