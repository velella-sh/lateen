import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { renderToString } from "preact-render-to-string";
import type { ComponentProps, DataRecord, Page, Site } from "@velella/mizzen/contracts";
import recordTable, { LABEL_CLASS, STACK_CLASS } from "../components/record-table/index.ts";

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

test("a stacked table carries a label in every cell, in the markup assistive technology reads", () => {
  const out = render({ from: "books", columns, stack: "" });
  assert.match(out, new RegExp(`<div class="${STACK_CLASS}"><div class="table-scroll"`));
  assert.match(
    out,
    /<td class="record-table-cell" data-kind="text"[^>]*><span class="record-table-label">Title<\/span><a href="\/books\/a\/">Alpha<\/a><\/td>/,
  );
  assert.match(out, /<span class="record-table-label">Pages<\/span>120<\/td>/);
  assert.match(out, /<span class="record-table-label">Published<\/span><time datetime="2026-11-09">/);
  assert.match(out, /<span class="record-table-label">Draft<\/span>No<\/td>/);
  assert.equal((out.match(new RegExp(LABEL_CLASS, "g")) ?? []).length, books.length * 4);
});

test("a table without the opt-in keeps its scroll region and carries no stack class", () => {
  const out = render({ from: "books", columns });
  assert.match(out, /<div class="table-scroll"/);
  assert.ok(!out.includes(STACK_CLASS));
  assert.ok(!out.includes(LABEL_CLASS));
});

