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

const record = (id: string, fields: Record<string, unknown>): DataRecord =>
  ({ id, fields, position: { line: 1, column: 1 }, fieldPositions: {} }) as unknown as DataRecord;

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

function html(ids = "a,c"): string {
  const input = { props: { from: "books", ids, fields }, page, site, html: "" } as unknown as ComponentProps;
  return renderToString(compare(input) as never);
}

interface Harness {
  readonly document: Document;
  readonly urls: string[];
  readonly fetches: string[];
  readonly unhandled: unknown[];
}

function harness(ids = "a,c", search = "", index = INDEX): Harness {
  const document = new JSDOM(`<!doctype html><html lang="en"><body>${html(ids)}</body></html>`).window.document;
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
  assert.deepEqual(cells.map((cell) => cell.textContent), ["80", "February 27, 2026"]);
  assert.deepEqual(urls, ["?records=b%2Cc#records"]);
  assert.equal(document.querySelector(".compare-status")?.textContent, "2 of 2 rows shown");
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
