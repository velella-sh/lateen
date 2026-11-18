import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToString } from "preact-render-to-string";
import type { ComponentProps, DataRecord, Page, Site } from "@velella/mizzen/contracts";
import compare, { CELL_CLASS, ERROR_CLASS, MISSING_CLASS, directive, idsOf } from "../components/compare/index.ts";

const record = (id: string, fields: Record<string, unknown>): DataRecord =>
  ({ id, fields, position: { line: 1, column: 1 }, fieldPositions: {} }) as unknown as DataRecord;

const books = [
  record("a", { title: "Alpha", pages: 120, published: "2026-11-09", draft: false }),
  record("b", { title: "Beta", pages: 80, published: "2026-02-30", draft: true }),
  record("c", { title: "Gamma", pages: 200, published: "2026-03-01", draft: false }),
  record("d", { title: "Delta", pages: 60, published: "2026-04-02", draft: true }),
  record("e", { title: "Echo", pages: 40, published: "2026-05-03", draft: false }),
];

const site = {
  config: { base: "" },
  nav: {},
  data: {},
  pages: ["a", "b", "c", "d", "e"].map((id) => ({ url: `/books/${id}/`, record: { collection: "books", id } })),
  collections: { books: { name: "books", source: "books.yml", records: books } },
} as unknown as Site;

const page = { lang: "en", url: "/books/", frontMatter: {} } as unknown as Page;

function render(props: Record<string, unknown>, lang = "en"): string {
  const input = { props, page: { ...page, lang }, site, html: "" } as unknown as ComponentProps;
  return renderToString(compare(input) as never);
}

const fields = JSON.stringify([
  { field: "pages", label: "Pages", kind: "number" },
  { field: "published", label: "Published", kind: "date" },
  { field: "draft", label: "Draft", kind: "boolean" },
]);

test("the directive is compare", () => {
  assert.equal(directive, "compare");
});

test("ids read a JSON array or a comma list", () => {
  assert.deepEqual(idsOf('["a", "b"]'), ["a", "b"]);
  assert.deepEqual(idsOf("a, b"), ["a", "b"]);
  assert.deepEqual(idsOf(""), []);
  assert.deepEqual(idsOf("["), []);
});

test("two records are two linked columns in the ids order", () => {
  const out = render({ from: "books", ids: "b,a", fields });
  assert.match(
    out,
    /<th scope="col" data-compare-column="0"><a href="\/books\/b\/">Beta<\/a><\/th><th scope="col" data-compare-column="1"><a href="\/books\/a\/">Alpha<\/a><\/th>/,
  );
  assert.ok(out.indexOf('/books/b/') < out.indexOf('/books/a/'), "the columns keep the ids order");
});

test("four records are four columns, and no record outside ids is rendered", () => {
  const out = render({ from: "books", ids: '["a","b","c","d"]', fields });
  assert.equal((out.match(/<th scope="col" /g) ?? []).length, 4);
  assert.match(out, /<th scope="col" data-compare-column="3"><a href="\/books\/d\/">Delta<\/a><\/th>/);
  assert.ok(!out.includes("Echo"), "the record not named in ids stays out");
  assert.ok(!out.includes("/books/e/"), "and so does its page");
});

test("each field is a row header, in the fields order", () => {
  const out = render({ from: "books", ids: "a,b", fields });
  assert.equal((out.match(/<th scope="row">/g) ?? []).length, 3);
  assert.ok(out.indexOf("<th scope=\"row\">Pages") < out.indexOf("<th scope=\"row\">Published"));
  assert.ok(out.indexOf("<th scope=\"row\">Published") < out.indexOf("<th scope=\"row\">Draft"));
});

test("every cell is formatted with its field kind", () => {
  const out = render({ from: "books", ids: "a,b", fields });
  assert.match(out, new RegExp(`<td class="${CELL_CLASS}" data-kind="number" data-compare-column="0">120</td>`));
  assert.match(out, new RegExp(`<td class="${CELL_CLASS}" data-kind="date" data-compare-column="0"><time datetime="2026-11-09">November 9, 2026</time></td>`));
  assert.match(out, new RegExp(`<td class="${CELL_CLASS}" data-kind="boolean" data-compare-column="0">No</td>`));
  assert.match(out, new RegExp(`<td class="${CELL_CLASS}" data-kind="boolean" data-compare-column="1">Yes</td>`));
  assert.match(out, new RegExp(`<td class="${CELL_CLASS}" data-kind="date" data-compare-column="1">2026-02-30</td>`));
});

test("an unknown id is a visible message and the other columns still render", () => {
  const out = render({ from: "books", ids: "a,z,b", fields });
  assert.match(out, new RegExp(`class="${MISSING_CLASS}" role="note"`));
  assert.match(out, /No record with id &quot;z&quot;\./);
  assert.match(out, /<a href="\/books\/a\/">Alpha<\/a>/);
  assert.match(out, /<a href="\/books\/b\/">Beta<\/a>/);
});

test("an unknown collection or a missing setup shows a note instead of a table", () => {
  const unknown = render({ from: "films", ids: "a", fields });
  assert.match(unknown, new RegExp(`class="${ERROR_CLASS}" role="note"`));
  assert.match(unknown, /The site has no collection named &quot;films&quot;\./);
  assert.ok(!unknown.includes("<table"));

  for (const props of [{ fields }, { from: "books", fields }, { from: "books", ids: "a" }]) {
    assert.match(render(props), /compare needs a collection/);
  }
});
