import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToString } from "preact-render-to-string";
import type { ComponentProps, DataRecord, Page, Site } from "@velella/mizzen/contracts";
import recordTable, { ERROR_CLASS, MISSING_CLASS, directive } from "../components/record-table/index.ts";

const record = (id: string, fields: Record<string, unknown>): DataRecord =>
  ({ id, fields, position: { line: 1, column: 1 }, fieldPositions: {} }) as unknown as DataRecord;

const books = [
  record("a", { title: "Alpha", pages: 120, published: "2026-11-09", draft: false }),
  record("b", { title: "Beta", pages: 80, published: "2026-02-30", draft: true }),
];

const site = {
  config: { base: "" },
  nav: {},
  data: {},
  pages: [
    { url: "/books/a/", record: { collection: "books", id: "a" } },
    { url: "/books/b/", record: { collection: "books", id: "b" } },
  ],
  collections: { books: { name: "books", source: "books.yml", records: books } },
} as unknown as Site;

const page = { lang: "en", url: "/books/", frontMatter: {} } as unknown as Page;

function render(props: Record<string, unknown>, lang = "en"): string {
  const input = { props, page: { ...page, lang }, site, html: "" } as unknown as ComponentProps;
  return renderToString(recordTable(input) as never);
}

const columns = JSON.stringify([
  { field: "title", label: "Title" },
  { field: "pages", label: "Pages", kind: "number" },
  { field: "published", label: "Published", kind: "date" },
  { field: "draft", label: "Draft", kind: "boolean" },
]);

test("the directive is record-table", () => {
  assert.equal(directive, "record-table");
});

test("columns keep their order and labels, and every cell uses its kind", () => {
  const out = render({ from: "books", columns });
  assert.match(out, /<th scope="col">Title<\/th><th scope="col">Pages<\/th><th scope="col">Published<\/th><th scope="col">Draft<\/th>/);
  assert.match(out, /<td class="record-table-cell" data-kind="number">120<\/td>/);
  assert.match(out, /<td class="record-table-cell" data-kind="date"><time datetime="2026-11-09">November 9, 2026<\/time><\/td>/);
  assert.match(out, /<td class="record-table-cell" data-kind="boolean">No<\/td>/);
  assert.match(out, /data-kind="boolean">Yes<\/td>/);
  assert.match(out, /<td class="record-table-cell" data-kind="date">2026-02-30<\/td>/);
});

test("the first column links to the record's page", () => {
  const out = render({ from: "books", columns });
  assert.match(out, /<td class="record-table-cell" data-kind="text"><a href="\/books\/a\/">Alpha<\/a><\/td>/);
  assert.match(out, /<td class="record-table-cell" data-kind="text"><a href="\/books\/b\/">Beta<\/a><\/td>/);
});

test("the caption is rendered and names the scroll region", () => {
  const out = render({ from: "books", columns, caption: "Every book" });
  assert.match(out, /<div class="table-scroll" data-table-scroll="true" tabindex="0" role="region" aria-label="Every book" data-label="Every book">/);
  assert.match(out, /<caption>Every book<\/caption>/);
});

test("an unknown field is a visible message in its cells, not an empty cell", () => {
  const out = render({ from: "books", columns: JSON.stringify([{ field: "title" }, { field: "editor", label: "Editor" }]) });
  assert.match(out, /<th scope="col">Editor<\/th>/);
  assert.equal((out.match(new RegExp(MISSING_CLASS, "g")) ?? []).length, 2);
  assert.match(out, /No field named &quot;editor&quot;\./);
});

test("an unknown collection shows a note instead of a table", () => {
  const out = render({ from: "films", columns });
  assert.match(out, new RegExp(`class="${ERROR_CLASS}" role="note"`));
  assert.match(out, /The site has no collection named &quot;films&quot;\./);
  assert.ok(!out.includes("<table"));
});

test("a missing collection or columns shows a setup message", () => {
  assert.match(render({ columns }), /record-table needs a collection/);
  assert.match(render({ from: "books" }), /record-table needs a collection/);
  assert.match(render({ from: "books", columns: "not json" }), /record-table needs a collection/);
});

test("a Persian page formats numbers, dates and booleans in Persian", () => {
  const out = render({ from: "books", columns }, "fa");
  assert.match(out, /data-kind="number">۱۲۰<\/td>/);
  assert.match(out, /<time datetime="2026-11-09">۱۸ آبان ۱۴۰۵<\/time>/);
  assert.match(out, /data-kind="boolean">خیر<\/td>/);
});

test("ready records render in the given order without reading a collection", () => {
  const ready = [
    { id: "b", fields: { title: "Beta", pages: 80 }, url: "/books/b/" },
    { id: "a", fields: { title: "Alpha", pages: 120 }, url: "/books/a/" },
  ];
  const out = render({
    records: ready,
    columns: [
      { field: "title", label: "Title" },
      { field: "pages", label: "Pages", kind: "number" },
    ],
  });
  assert.ok(out.indexOf('/books/b/') < out.indexOf('/books/a/'), "the rows keep the layout's order");
  assert.match(out, /<a href="\/books\/b\/">Beta<\/a>/);
  assert.match(out, /data-kind="number">80<\/td>/);
});
