import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { renderToString } from "preact-render-to-string";
import type { ComponentProps, DataRecord, Page, Site } from "@velella/mizzen/contracts";
import compare from "../components/compare/index.ts";
import {
  activate,
  onlyDiff,
  rowsShownText,
  withDiff,
  type CompareDocument,
  type CompareElement,
  type CompareEnv,
} from "../components/compare/client.ts";

const record = (id: string, fields: Record<string, unknown>): DataRecord =>
  ({ id, fields, position: { line: 1, column: 1 }, fieldPositions: {} }) as unknown as DataRecord;

const books = [
  record("a", { title: "Alpha", pages: 120, draft: false }),
  record("c", { title: "Gamma", pages: 200, draft: false }),
  record("e", { title: "Echo", pages: 40, draft: false }),
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
  { field: "draft", label: "Draft", kind: "boolean" },
]);

function html(): string {
  const input = { props: { from: "books", ids: "a,c,e", fields }, page, site, html: "" } as unknown as ComponentProps;
  return renderToString(compare(input) as never);
}

function docOf(): Document {
  return new JSDOM(`<!doctype html><html lang="en"><body>${html()}</body></html>`).window.document;
}

function envOf(search: string, onUrl: (url: string) => void = () => {}): CompareEnv {
  return { search: () => search, hash: () => "#records", replaceUrl: onUrl };
}

const rows = (document: Document): HTMLElement[] => [...document.querySelectorAll<HTMLElement>("[data-compare-row]")];
const toggleOf = (document: Document): HTMLInputElement => document.querySelector(".compare-only-diff")!;

test("the controls start hidden and every row stays in the document", () => {
  const out = html();
  assert.match(out, /class="compare-controls" hidden/);
  assert.equal((out.match(/data-compare-row/g) ?? []).length, 2, "both rows render without a script");
  assert.equal((out.match(/class="compare-diff"/g) ?? []).length, 1, "the row that differs is marked");
});

test("the island reveals the toggle and announces every row", () => {
  const document = docOf();
  activate(document as unknown as CompareDocument, envOf(""));

  const controls = document.querySelector(".compare-controls") as HTMLElement;
  assert.equal(controls.hidden, false);
  assert.equal(document.querySelector(".compare-status")!.textContent, "2 of 2 rows shown");
  assert.ok(rows(document).every((row) => !row.hidden));
});

test("checking the toggle hides rows without a difference but keeps them", () => {
  const document = docOf();
  activate(document as unknown as CompareDocument, envOf(""));

  toggleOf(document).click();

  assert.equal(rows(document).length, 2, "no row is removed");
  assert.equal(rows(document).filter((row) => row.hidden).length, 1, "the equal row is hidden");
  assert.equal(document.querySelector(".compare-status")!.textContent, "1 of 2 rows shown");
});

test("the address opens the differences-only view and keeps the other parameters", () => {
  const document = docOf();
  const urls: string[] = [];
  activate(document as unknown as CompareDocument, envOf("?compare=diff&lang=fa", (url) => urls.push(url)));

  assert.equal(toggleOf(document).checked, true);
  assert.equal(rows(document).filter((row) => row.hidden).length, 1);
  assert.equal(document.querySelector(".compare-status")!.textContent, "1 of 2 rows shown");

  toggleOf(document).click();
  assert.deepEqual(urls, ["?lang=fa#records"]);
  assert.ok(rows(document).every((row) => !row.hidden));
});

test("the choice round-trips through the query string", () => {
  assert.equal(onlyDiff("?compare=diff"), true);
  assert.equal(onlyDiff("?compare=DIFF"), false);
  assert.equal(onlyDiff("?lang=fa"), false);
  assert.equal(withDiff("?lang=fa", true), "?lang=fa&compare=diff");
  assert.equal(withDiff("?compare=diff&lang=fa", false), "?lang=fa");
  assert.equal(withDiff("", false), "");
  assert.equal(rowsShownText("{count} of {total} rows shown", 2, 3), "2 of 3 rows shown");
});

test("a Persian page gets its own toggle wording", () => {
  const input = {
    props: { from: "books", ids: "a,c,e", fields },
    page: { ...page, lang: "fa" },
    site,
    html: "",
  } as unknown as ComponentProps;
  const out = renderToString(compare(input) as never);
  assert.match(out, /فقط تفاوت‌ها را نشان بده/);
  assert.match(out, /2 از 2 سطر نمایش داده می‌شود/);
});
