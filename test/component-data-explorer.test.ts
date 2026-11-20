import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToString } from "preact-render-to-string";
import type { ComponentProps, DataRecord, Page, Site } from "@velella/mizzen/contracts";
import dataExplorer, {
  COLLECTION_FILTER,
  PAGE_SIZE,
  QUERY_ID,
  directive,
} from "../components/data-explorer/index.ts";
import { dataRecord } from "./helpers/record.ts";

const record = (id: string, fields: Record<string, unknown>): DataRecord => dataRecord({ id, fields });

const books = Array.from({ length: PAGE_SIZE + 1 }, (_, index) =>
  record(`b${index}`, { title: `Book ${index}`, pages: index }),
);

const site = (base = ""): Site =>
  ({
    config: { base },
    nav: {},
    data: {},
    pages: books.map((book) => ({ url: `/books/${book.id}/`, record: { collection: "books", id: book.id } })),
    collections: { books: { name: "books", source: "books.yml", records: books } },
  }) as unknown as Site;

const page = { lang: "en", url: "/books/", frontMatter: {} } as unknown as Page;

function render(props: Record<string, unknown>, lang = "en", base = ""): string {
  const input = { props, page: { ...page, lang }, site: site(base), html: "" } as unknown as ComponentProps;
  return renderToString(dataExplorer(input) as never);
}

test("the directive is data-explorer", () => {
  assert.equal(directive, "data-explorer");
});

test("the form is a GET form for the site's search page, carrying the collection", () => {
  const out = render({ from: "books", columns: "title,pages" });
  assert.match(out, /<form class="data-explorer-form" role="search" method="get" action="\/search\/">/);
  assert.match(out, new RegExp(`<label class="data-explorer-label" for="${QUERY_ID}">Search<\\/label>`));
  assert.match(out, new RegExp(`<input class="data-explorer-input" id="${QUERY_ID}" name="q" type="search"`));
  assert.match(out, new RegExp(`<input type="hidden" name="${COLLECTION_FILTER}" value="books"\\s*/>`));
  assert.match(out, /<button class="data-explorer-submit" type="submit">Search<\/button>/);
});

test("the form action follows the site base, and so does the island's base", () => {
  const out = render({ from: "books", columns: "title,pages" }, "en", "/alpha");
  assert.match(out, /action="\/alpha\/search\/"/);
  assert.match(out, /data-base="\/alpha"/);
});

test("the first 50 records render as a table with the same columns and record links", () => {
  const out = render({ from: "books", columns: "title,pages" });
  assert.match(out, /<th scope="col"[^>]*>title<button[^>]*>[\s\S]*?<\/button><\/th><th scope="col"[^>]*>pages<button[^>]*>[\s\S]*?<\/button><\/th>/);
  assert.match(out, /<td class="record-table-cell" data-kind="text"[^>]*><a href="\/books\/b0\/">Book 0<\/a><\/td>/);
  assert.match(out, /<td class="record-table-cell" data-kind="text"[^>]*><a href="\/books\/b49\/">Book 49<\/a><\/td>/);
  assert.ok(!out.includes("Book 50"), "the 51st record waits for the island");
});

test("the column array form, with labels and kinds, is accepted too", () => {
  const columns = JSON.stringify([
    { field: "title", label: "Title" },
    { field: "pages", label: "Pages", kind: "number" },
  ]);
  const out = render({ from: "books", columns });
  assert.match(out, /<th scope="col"[^>]*>Title<button[^>]*>[\s\S]*?<\/button><\/th><th scope="col"[^>]*>Pages<button[^>]*>[\s\S]*?<\/button><\/th>/);
  assert.match(out, /<td class="record-table-cell" data-kind="number"[^>]*>3<\/td>/);
});

test("every island message is a data attribute, in the page language", () => {
  const en = render({ from: "books", columns: "title" });
  assert.match(en, /data-explorer-loading="Loading search…"/);
  assert.match(en, /data-explorer-failed="Search is unavailable right now\."/);
  assert.match(en, /data-explorer-empty="No results for “\{query\}”\."/);
  assert.match(en, /data-explorer-retry="Try again"/);
  assert.match(en, /data-explorer-more="Show more"/);
  assert.match(en, /data-explorer-count-one="\{n\} result\."/);
  assert.match(en, /data-explorer-count-other="\{n\} results\."/);
  assert.match(en, /data-lang="en"/);

  const fa = render({ from: "books", columns: "title" }, "fa");
  assert.match(fa, /data-explorer-more="نمایش بیشتر"/);
  assert.match(fa, /data-explorer-count-other="[^"]*\{n\}[^"]*"/);

  const ar = render({ from: "books", columns: "title" }, "ar");
  assert.match(ar, /data-explorer-more="عرض المزيد"/);
  assert.match(ar, /data-explorer-loading="[^"]+"/);
});

test("a collection the site lacks shows the note and no form", () => {
  const out = render({ from: "missing", columns: "title" });
  assert.match(out, /class="record-table-error"/);
  assert.ok(!out.includes("<form"), "no control that cannot work");
});

test("a directive without columns shows the note and no form", () => {
  const out = render({ from: "books" });
  assert.match(out, /class="record-table-error"/);
  assert.ok(!out.includes("<form"));
});
