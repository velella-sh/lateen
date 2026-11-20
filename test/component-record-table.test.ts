import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToString } from "preact-render-to-string";
import type { ComponentProps, DataRecord, Page, Site } from "@velella/mizzen/contracts";
import recordTable, { ERROR_CLASS, MISSING_CLASS, directive } from "../components/record-table/index.ts";

const record = (id: string, fields: Record<string, unknown>): DataRecord =>
  ({ id, fields, position: { line: 1, column: 1 }, fieldPositions: {} }) as unknown as DataRecord;

const books = [
  record("a", { title: "Alpha", pages: 120, published: "2026-11-09", draft: false, tags: ["one", "two", "three", "four"] }),
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
  assert.match(out, /<th scope="col"[^>]*>Title<button[^>]*>[\s\S]*?<\/button><\/th><th scope="col"[^>]*>Pages<button[^>]*>[\s\S]*?<\/button><\/th><th scope="col"[^>]*>Published<button[^>]*>[\s\S]*?<\/button><\/th><th scope="col">Draft<\/th>/);
  assert.match(out, /<td class="record-table-cell" data-kind="number"[^>]*>120<\/td>/);
  assert.match(out, /<td class="record-table-cell" data-kind="date"[^>]*><time datetime="2026-11-09">November 9, 2026<\/time><\/td>/);
  assert.match(out, /<td class="record-table-cell" data-kind="boolean"[^>]*>No<\/td>/);
  assert.match(out, /data-kind="boolean"[^>]*>Yes<\/td>/);
  assert.match(out, /<td class="record-table-cell" data-kind="date"[^>]*>2026-02-30<\/td>/);
});

test("the first column links to the record's page", () => {
  const out = render({ from: "books", columns });
  assert.match(out, /<td class="record-table-cell" data-kind="text"[^>]*><a href="\/books\/a\/">Alpha<\/a><\/td>/);
  assert.match(out, /<td class="record-table-cell" data-kind="text"[^>]*><a href="\/books\/b\/">Beta<\/a><\/td>/);
});

test("the caption is rendered and names the scroll region", () => {
  const out = render({ from: "books", columns, caption: "Every book" });
  assert.match(out, /<div class="table-scroll" data-table-scroll="true" tabindex="0" role="region" aria-label="Every book" data-label="Every book">/);
  assert.match(out, /<caption>Every book<\/caption>/);
});

test("a long list cell keeps every value, its order, and its data-value", () => {
  const out = render({ from: "books", columns: JSON.stringify([{ field: "title" }, { field: "tags", label: "Tags", kind: "list" }]) });
  assert.match(out, /<td class="record-table-cell" data-kind="list" data-value="one,two,three,four">/);
  assert.match(
    out,
    /<ul class="field-list"><li>one<\/li><li>two<\/li><li>three<\/li><\/ul><details class="field-list-more"><summary>Show all<\/summary><ul class="field-list"><li>four<\/li><\/ul><\/details>/,
  );
});

test("an unknown field is a visible message in its cells, not an empty cell", () => {
  const out = render({ from: "books", columns: JSON.stringify([{ field: "title" }, { field: "editor", label: "Editor" }]) });
  assert.match(out, /<th scope="col"[^>]*>Editor<button/);
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
  assert.match(out, /data-kind="number"[^>]*>۱۲۰<\/td>/);
  assert.match(out, /<time datetime="2026-11-09">۱۸ آبان ۱۴۰۵<\/time>/);
  assert.match(out, /data-kind="boolean"[^>]*>خیر<\/td>/);
});

test("package names and ids stay left to right in a right-to-left table", () => {
  const out = render(
    {
      records: [{ id: "@scope/pkg/guide", fields: { package: "@scope/pkg" }, url: "/packages/guide/" }],
      columns: [
        { field: "id", label: "Identifier" },
        { field: "package", label: "Package" },
      ],
    },
    "fa",
  );
  assert.match(
    out,
    /<td class="record-table-cell" data-kind="text"[^>]*><a href="\/packages\/guide\/"><bdi dir="ltr">@scope\/pkg\/guide<\/bdi><\/a><\/td>/,
  );
  assert.match(out, /<td class="record-table-cell" data-kind="text"[^>]*><bdi dir="ltr">@scope\/pkg<\/bdi><\/td>/);
  assert.doesNotMatch(out, /<bdi[^>]*>Package<\/bdi>/);
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
  assert.match(out, /data-kind="number"[^>]*>80<\/td>/);
});

test("reference cells link to the records the engine resolved, and unresolved values stay text", () => {
  const out = render({
    records: [
      { id: "b", fields: { title: "Beta", author: "ada" }, url: "/books/b/", links: { author: "/people/ada/" } },
      { id: "a", fields: { title: "Alpha", author: "grace" }, url: "/books/a/", links: {} },
    ],
    columns: [
      { field: "title", label: "Title" },
      { field: "author", label: "Author" },
    ],
  });
  assert.match(out, /<a href="\/books\/b\/">Beta<\/a>/);
  assert.match(out, /<td class="record-table-cell" data-kind="text"[^>]*><a href="\/people\/ada\/">ada<\/a><\/td>/);
  assert.match(out, /<td class="record-table-cell" data-kind="text"[^>]*>grace<\/td>/);
  assert.ok(!out.includes(">grace</a>"), "no link without a resolved target");
});

test("a reference cell keeps the engine's base path on a right-to-left page", () => {
  const out = render(
    {
      records: [
        { id: "b", fields: { title: "Beta", author: "@scope/ada" }, url: "/books/b/", links: { author: "/fa/base/people/@scope/ada/" } },
      ],
      columns: [
        { field: "title", label: "Title" },
        { field: "author", label: "Author" },
      ],
    },
    "fa",
  );
  assert.match(out, /<a href="\/fa\/base\/people\/@scope\/ada\/"><bdi dir="ltr">@scope\/ada<\/bdi><\/a>/);
});
