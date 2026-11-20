// The narrow view is the same table: every record title is repeated in each value cell, so the
// column headers and the old tab controls are not needed.
import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { renderToString } from "preact-render-to-string";
import type { ComponentProps, DataRecord, Page, Site } from "@velella/mizzen/contracts";
import compare, { RECORD_CLASS } from "../components/compare/index.ts";
import { activate, type CompareDocument, type CompareEnv } from "../components/compare/client.ts";
import { dataRecord } from "./helpers/record.ts";

const record = (id: string, fields: Record<string, unknown>): DataRecord => dataRecord({ id, fields });

const books = [
  record("a", { title: "Alpha", pages: 120, published: "2026-01-02" }),
  record("b", { title: "Beta", pages: 80, published: "2026-02-03" }),
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

function html(): string {
  const input = { props: { from: "books", ids: "a,b", fields }, page, site, html: "" } as unknown as ComponentProps;
  return renderToString(compare(input) as never);
}

const env: CompareEnv = {
  search: () => "",
  hash: () => "",
  replaceUrl: () => {},
};

test("the comparison renders no tab row and repeats each record title in every row", () => {
  const out = html();
  assert.doesNotMatch(out, /compare-tabs|compare-tab/);
  assert.equal((out.match(new RegExp(`class="${RECORD_CLASS}"`, "g")) ?? []).length, 4);
});

test("activating the island leaves every record and row in the one table", () => {
  const document = new JSDOM(`<!doctype html><html lang="en"><body>${html()}</body></html>`).window.document;
  activate(document as unknown as CompareDocument, env);

  assert.equal(document.querySelector(".compare-tabs"), null);
  assert.equal(document.querySelectorAll("[data-compare-row]").length, 2);
  assert.ok([...document.querySelectorAll<HTMLElement>("[data-compare-column]")].every((cell) => !cell.hidden));
});
