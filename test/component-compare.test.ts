import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToString } from "preact-render-to-string";
import type { ComponentProps, DataRecord, Page, Site } from "@velella/mizzen/contracts";
import compare, {
  CELL_CLASS,
  ERROR_CLASS,
  MISSING_CLASS,
  SUMMARY_CHANGED_CLASS,
  SUMMARY_CLASS,
  directive,
  idsOf,
} from "../components/compare/index.ts";

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

const specs = [
  record("one", { title: "One", price: 0, note: "same", color: "red", format: "print" }),
  record("two", { title: "Two", price: 0, note: "same", color: "blue" }),
  record("five", { title: "Five", price: 5, note: "same", color: "blue", format: "print" }),
];

const specsSite = {
  ...site,
  pages: [],
  collections: { specs: { name: "specs", source: "specs.yml", records: specs } },
} as unknown as Site;

function render(props: Record<string, unknown>, lang = "en", source: Site = site): string {
  const input = { props, page: { ...page, lang }, site: source, html: "" } as unknown as ComponentProps;
  return renderToString(compare(input) as never);
}

/** The summary paragraph, from its opening tag to its close. */
function summaryOf(out: string): string {
  const start = out.indexOf(`<p class="${SUMMARY_CLASS}">`);
  assert.notEqual(start, -1, "no summary");
  return out.slice(start, out.indexOf("</p>", start));
}

function specsFields(...names: string[]): string {
  return JSON.stringify(
    names.map((field) => ({
      field,
      label: field.charAt(0).toUpperCase() + field.slice(1),
      kind: field === "price" ? "number" : "text",
    })),
  );
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

test("the summary counts same, different, and missing fields, and names the changed fields", () => {
  const out = render(
    { from: "specs", ids: "one,two", fields: specsFields("price", "note", "color", "format") },
    "en",
    specsSite,
  );
  const summary = summaryOf(out);
  assert.match(summary, />2 same · 1 different · 1 missing/);
  assert.match(summary, /Changed: Color, Format/);
  assert.ok(!summary.includes("Price"), "a same field is not listed as changed");
  assert.ok(!summary.includes("Note"), "a same field is not listed as changed");
  assert.ok(out.indexOf(summary) < out.indexOf("<table"), "the summary comes before the table");
});

test("identical records count every field as the same and name no change", () => {
  const out = render(
    { from: "specs", ids: "one,two", fields: specsFields("price", "note") },
    "en",
    specsSite,
  );
  const summary = summaryOf(out);
  assert.match(summary, />2 same · 0 different · 0 missing/);
  assert.ok(!summary.includes(SUMMARY_CHANGED_CLASS), "there is nothing to name as changed");
});

test("a value one record lacks counts as missing and names its field", () => {
  const out = render(
    { from: "specs", ids: "one,two", fields: specsFields("format") },
    "en",
    specsSite,
  );
  const summary = summaryOf(out);
  assert.match(summary, />0 same · 0 different · 1 missing/);
  assert.match(summary, /Changed: Format/);
});

test("a zero is a value: equal zeros are the same, and a zero against five differs", () => {
  const equal = render(
    { from: "specs", ids: "one,two", fields: specsFields("price") },
    "en",
    specsSite,
  );
  assert.match(summaryOf(equal), />1 same · 0 different · 0 missing/);
  assert.match(equal, /<td class="compare-cell" data-kind="number" data-compare-column="0">0<\/td>/);

  const differs = render(
    { from: "specs", ids: "one,five", fields: specsFields("price") },
    "en",
    specsSite,
  );
  assert.match(summaryOf(differs), />0 same · 1 different · 0 missing/);
});

test("the summary reads in the page language with its digits", () => {
  const out = render(
    { from: "specs", ids: "one,two", fields: specsFields("price", "note", "color", "format") },
    "fa",
    specsSite,
  );
  const summary = summaryOf(out);
  assert.match(summary, /۲ یکسان · ۱ متفاوت · ۱ ناموجود/);
  assert.match(summary, /تغییر یافته:/);
  assert.match(summary, /Color، Format/);
});
