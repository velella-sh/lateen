// The picker reads the collection's index only when the reader opens it, replaces that column's
// header and cells, recomputes the differences, and keeps the choice in the address.
import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { renderToString } from "preact-render-to-string";
import type { ComponentProps, DataRecord, Page, Site } from "@velella/mizzen/contracts";
import compare from "../components/compare/index.ts";
import { activate, type CompareDocument, type CompareEnv } from "../components/compare/client.ts";
import { recordsOf, withRecords } from "../components/compare/picker.ts";
import { dataRecord } from "./helpers/record.ts";

const record = (id: string, fields: Record<string, unknown>): DataRecord => dataRecord({ id, fields });

const books = [
  record("a", { title: "Alpha", pages: 120, published: "2026-11-09" }),
  record("b", { title: "Beta", pages: 80, published: "2026-02-27" }),
  record("c", { title: "Gamma", pages: 200, published: "2026-06-01" }),
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
  { field: "published", label: "Published", kind: "date" },
]);

const INDEX = JSON.stringify({
  collection: "books",
  columns: ["id", "title", "pages", "published", "url"],
  rows: [
    ["a", "Alpha", 120, "2026-11-09", "/books/a/"],
    ["b", "Beta", 80, "2026-02-27", "/books/b/"],
    ["c", "Gamma", 200, "2026-06-01", "/books/c/"],
  ],
});

function html(ids = "a,c", lang = "en", base = ""): string {
  const input = {
    props: { from: "books", ids, fields },
    page: { ...page, lang } as unknown as Page,
    site: { ...site, config: { base } } as unknown as Site,
    html: "",
  } as unknown as ComponentProps;
  return renderToString(compare(input) as never);
}

interface Harness {
  readonly document: Document;
  readonly urls: string[];
  readonly fetches: string[];
  readonly unhandled: unknown[];
}

interface HarnessOptions {
  readonly lang?: string;
  readonly base?: string;
  readonly dir?: string;
}

function harness(ids = "a,c", search = "", index = INDEX, options: HarnessOptions = {}): Harness {
  const { lang = "en", base = "", dir } = options;
  const attributes = `lang="${lang}"${dir === undefined ? "" : ` dir="${dir}"`}`;
  const document = new JSDOM(
    `<!doctype html><html ${attributes}><body>${html(ids, lang, base)}</body></html>`,
  ).window.document;
  const urls: string[] = [];
  const fetches: string[] = [];
  const unhandled: unknown[] = [];
  process.on("unhandledRejection", (error) => unhandled.push(error));
  const env: CompareEnv = {
    search: () => search,
    hash: () => "#records",
    replaceUrl: (url) => urls.push(url),
    fetchText: async (url, signal) => {
      fetches.push(url);
      assert.equal(signal.aborted, false);
      return index;
    },
  };
  activate(document as unknown as CompareDocument, env);
  return { document, urls, fetches, unhandled };
}

/** Lets the loader's promise chain run. */
const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

const picks = (document: Document): HTMLButtonElement[] => [
  ...document.querySelectorAll<HTMLButtonElement>(".compare-pick"),
];

const panels = (document: Document): HTMLElement[] => [
  ...document.querySelectorAll<HTMLElement>(".compare-picker"),
];

const titles = (document: Document): (string | null)[] => [
  ...document.querySelectorAll<HTMLElement>(".compare-title"),
].map((title) => title.textContent);

/** Picks `id` in the column at `at`, as the select's change event does. */
function choose(document: Document, at: number, id: string): void {
  const select = panels(document)[at]!.querySelector("select") as HTMLSelectElement;
  select.value = id;
  const change = document.createEvent("Event");
  change.initEvent("change", true, false);
  select.dispatchEvent(change);
}

test("nothing is fetched on load; every column gets a closed picker", () => {
  const { document, fetches } = harness();

  assert.deepEqual(fetches, []);
  assert.equal(picks(document).length, 2);
  assert.ok(picks(document).every((button) => button.getAttribute("aria-expanded") === "false"));
  assert.ok(panels(document).every((panel) => panel.hidden));
  assert.equal(document.querySelector(".compare-title")?.textContent, "Alpha");
});

test("opening a picker reads the index once and lists every record", async () => {
  const { document, fetches } = harness();
  const button = picks(document)[0]!;

  button.click();
  assert.equal(fetches.length, 1);
  assert.equal(fetches[0], "/data/books.index.json");
  assert.equal(button.getAttribute("aria-expanded"), "true");
  assert.equal(panels(document)[0]!.hidden, false);
  assert.match(panels(document)[0]!.textContent ?? "", /Loading records/);

  await settle();
  const select = panels(document)[0]!.querySelector("select")!;
  assert.deepEqual(
    [...select.options].map((option) => option.value),
    ["a", "b", "c"],
  );
  assert.equal(select.value, "a");
  assert.equal(select.getAttribute("aria-label"), "Records");

  button.click();
  button.click();
  await settle();
  assert.equal(fetches.length, 1, "a later open uses the index already read");
});

test("choosing a record replaces the column's header and cells and recomputes the differences", async () => {
  const { document, urls } = harness();
  picks(document)[0]!.click();
  await settle();

  const select = panels(document)[0]!.querySelector("select") as HTMLSelectElement;
  select.value = "b";
  const change = document.createEvent("Event");
  change.initEvent("change", true, false);
  select.dispatchEvent(change);

  assert.equal(document.querySelector(".compare-title")?.textContent, "Beta");
  assert.equal(document.querySelector(".compare-title a")?.getAttribute("href"), "/books/b/");
  const cells = [...document.querySelectorAll<HTMLElement>('td[data-compare-column="0"]')];
  assert.deepEqual(cells.map((cell) => cell.querySelector(".compare-record")?.textContent), ["Beta", "Beta"]);
  assert.deepEqual(cells.map((cell) => cell.textContent), ["Beta80", "BetaFebruary 27, 2026"]);
  assert.deepEqual(urls, ["?records=b%2Cc#records"]);
  assert.equal(document.querySelector(".compare-status")?.textContent, "2 of 2 rows shown");
});

test("twenty later selections reuse the one index and do not grow the column", async () => {
  const { document, fetches } = harness();
  picks(document)[0]!.click();
  await settle();
  const afterOpen = panels(document)[0]!.querySelectorAll("option").length;
  const cellsAfterOpen = document.querySelectorAll('td[data-compare-column="0"]').length;

  choose(document, 0, "b");
  await settle();
  assert.equal(document.querySelector(".compare-title")?.textContent, "Beta");

  for (let at = 1; at <= 20; at++) {
    choose(document, 0, at % 2 === 0 ? "a" : "b");
    await settle();
  }

  assert.equal(fetches.length, 1, "the index is read once; a reparse would refetch it");
  assert.equal(document.querySelector(".compare-title")?.textContent, "Alpha", "the last choice wins");
  assert.equal(panels(document)[0]!.querySelectorAll("option").length, afterOpen);
  assert.equal(document.querySelectorAll('td[data-compare-column="0"]').length, cellsAfterOpen);
});

test("a failed fetch shows a message and a retry that reads the index again", async () => {
  const document = new JSDOM(`<!doctype html><html lang="en"><body>${html()}</body></html>`).window.document;
  let attempts = 0;
  activate(document as unknown as CompareDocument, {
    search: () => "",
    hash: () => "",
    replaceUrl: () => {},
    fetchText: async () => {
      attempts++;
      if (attempts === 1) throw new Error("offline");
      return INDEX;
    },
  });

  picks(document)[0]!.click();
  await settle();
  const panel = panels(document)[0]!;
  assert.match(panel.textContent ?? "", /Could not load the records/);
  const retry = panel.querySelector("button")!;
  assert.equal(retry.textContent, "Try again");

  retry.click();
  await settle();
  assert.equal(attempts, 2);
  assert.equal(panel.querySelector("select")?.value, "a");
});

test("an id in the address that the collection lacks is named in its column", async () => {
  const { document } = harness("a,c", "?records=a,ghost");
  picks(document)[0]!.click();
  await settle();

  const missing = panels(document)[1]!.querySelector(".compare-picker-missing")!;
  assert.match(missing.textContent ?? "", /No record with id "ghost"/);
  assert.equal((missing as HTMLElement).hidden, false);
});

test("the address's ids come back on the first open", async () => {
  const { document } = harness("a,c", "?records=b,c");
  assert.equal(document.querySelector(".compare-title")?.textContent, "Alpha", "nothing changes before a picker opens");

  picks(document)[0]!.click();
  await settle();
  assert.equal(document.querySelector(".compare-title")?.textContent, "Beta");
  assert.equal(panels(document)[0]!.querySelector("select")?.value, "b");
});

test("the choice round-trips through the query string, keeping every other parameter", () => {
  assert.deepEqual(recordsOf("?records=a,b"), ["a", "b"]);
  assert.deepEqual(recordsOf("?lang=fa"), []);
  assert.equal(withRecords("?lang=fa", ["a", "b"]), "?lang=fa&records=a%2Cb");
  assert.equal(withRecords("?records=a,b", ["", ""]), "");
});

test("a shared address restores the ids in its own order, not the page's", async () => {
  const { document } = harness("a,c", "?records=c,a");
  picks(document)[0]!.click();
  await settle();

  assert.deepEqual(titles(document), ["Gamma", "Alpha"]);
  assert.deepEqual(
    [...document.querySelectorAll<HTMLSelectElement>(".compare-picker select")].map((select) => select.value),
    ["c", "a"],
  );
  assert.deepEqual(
    [...document.querySelectorAll<HTMLElement>('td[data-compare-column="0"]')].map((cell) => cell.textContent),
    ["Gamma200", "GammaJune 1, 2026"],
  );
});

test("the address writes the reordered columns, not the order they were chosen in", async () => {
  const { document, urls } = harness();
  picks(document)[0]!.click();
  await settle();

  choose(document, 1, "b");
  choose(document, 0, "c");

  assert.deepEqual(titles(document), ["Gamma", "Beta"]);
  assert.deepEqual(urls, ["?records=a%2Cb#records", "?records=c%2Cb#records"]);
});

test("a shared duplicate applies twice, and an unknown id is dropped on the next write", async () => {
  const duplicate = harness("a,c", "?records=b,b");
  picks(duplicate.document)[0]!.click();
  await settle();
  assert.deepEqual(titles(duplicate.document), ["Beta", "Beta"]);

  const unknown = harness("a,c", "?records=ghost,b");
  picks(unknown.document)[0]!.click();
  await settle();
  assert.deepEqual(titles(unknown.document), ["Alpha", "Beta"], "an unknown id leaves its column's default");
  assert.match(panels(unknown.document)[0]!.textContent ?? "", /No record with id "ghost"/);

  choose(unknown.document, 1, "c");
  assert.deepEqual(
    unknown.urls,
    ["?records=a%2Cc#records"],
    "the column keeps its on-screen default and the unknown id is not written back",
  );
});

test("an absent parameter keeps the page's own records and order", async () => {
  const { document, urls } = harness("a,c", "");
  assert.deepEqual(titles(document), ["Alpha", "Gamma"]);

  picks(document)[1]!.click();
  await settle();
  assert.deepEqual(titles(document), ["Alpha", "Gamma"]);
  assert.deepEqual(
    [...document.querySelectorAll<HTMLSelectElement>(".compare-picker select")].map((select) => select.value),
    ["a", "c"],
  );
  assert.deepEqual(urls, []);
});

test("RTL and a site base do not change the restored order", async () => {
  const { document, fetches, urls } = harness("a,c", "?records=c,a", INDEX, {
    lang: "fa",
    base: "/lateen",
    dir: "rtl",
  });
  picks(document)[0]!.click();
  await settle();

  assert.equal(document.querySelector("html")?.getAttribute("dir"), "rtl");
  assert.deepEqual(titles(document), ["Gamma", "Alpha"]);
  assert.deepEqual(fetches, ["/lateen/data/books.index.json"]);

  choose(document, 0, "b");
  assert.deepEqual(urls, ["?records=b%2Ca#records"]);
});
