import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToString } from "preact-render-to-string";
import type { LayoutProps, ListPagination, ListProps, Page, RecordProps, Site, SiteConfig, SourcePos } from "@velella/mizzen/contracts";
import list from "../../layouts/list.ts";

const pos: SourcePos = { file: "books/index.md", line: 1, column: 1, endLine: 1, endColumn: 1 };

const config = {
  title: "Example",
  base: "",
  lang: "en",
  dir: "ltr",
  languages: [],
  source: ".",
  include: [],
  exclude: [],
  navigation: "_data/navigation.yml",
  defaults: [],
  theme: { options: {} },
  search: { text: 300 },
  redirects: {},
  outputs: {},
  collections: {},
  feeds: {},
} as unknown as SiteConfig;

const record = (id: string): RecordProps => ({ collection: "books", id, url: `/books/${id}/`, fields: { title: id }, links: {} });

function render(lang: string, count: number, pagination: ListPagination = { page: 1, total: 1 }): string {
  const page = {
    url: "/books/",
    source: pos,
    frontMatter: {},
    title: "Books",
    lang,
    dir: lang === "en" ? "ltr" : "rtl",
    headings: [],
    html: "<p>Every book in the catalogue.</p>",
    markdown: "Every book in the catalogue.",
    kind: "doc",
  } as Page;
  const data: ListProps = {
    collection: "books",
    records: Array.from({ length: count }, (_, index) => record(`book-${index + 1}`)),
    groups: [],
    pagination,
  };
  const site: Site = { config, pages: [page], nav: {}, data: {}, collections: {} };
  const props = {
    site,
    page,
    trail: [],
    pager: {},
    head: { title: "Books · Example", meta: [], links: [], jsonLd: [] },
    islands: [],
    list: data,
  } as unknown as LayoutProps;
  return renderToString(list(props) as never);
}

const countOf = (out: string) => out.match(/<span class="list-count">([^<]*)<\/span>/)?.[1];

test("English counts follow its plural rules", () => {
  assert.equal(countOf(render("en", 0)), "0 records");
  assert.equal(countOf(render("en", 1)), "1 record");
  assert.equal(countOf(render("en", 2)), "2 records");
  assert.equal(countOf(render("en", 12)), "12 records");
});

test("Persian counts use Persian digits and read zero and one alike", () => {
  assert.equal(countOf(render("fa", 0)), "۰ رکورد");
  assert.equal(countOf(render("fa", 1)), "۱ رکورد");
  assert.equal(countOf(render("fa", 2)), "۲ رکورد");
  assert.equal(countOf(render("fa", 12)), "۱۲ رکورد");
});

test("Arabic counts use the Arabic categories and digits", () => {
  assert.equal(countOf(render("ar", 0)), "٠ سجل");
  assert.equal(countOf(render("ar", 1)), "١ سجل");
  assert.equal(countOf(render("ar", 2)), "٢ سجلان");
  assert.equal(countOf(render("ar", 3)), "٣ سجلات");
  assert.equal(countOf(render("ar", 12)), "١٢ سجلًا");
});

test("an empty list says so and keeps its introduction", () => {
  const out = render("en", 0);
  assert.match(out, /<div class="list-intro"><p>Every book in the catalogue.<\/p><\/div>/);
  assert.match(out, /<p class="state state-empty state-note">This list has no records yet.<\/p>/);
  assert.equal(countOf(out), "0 records");
});

test("a paginated list says which page of how many the reader is on", () => {
  const out = render("en", 10, { page: 2, total: 5 });
  assert.match(out, /<span class="list-page">Page 2 of 5<\/span>/);
  assert.doesNotMatch(render("en", 10), /list-page/);
  assert.match(render("fa", 10, { page: 2, total: 5 }), /صفحهٔ ۲ از ۵/);
});
