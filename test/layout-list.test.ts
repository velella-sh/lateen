import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToString } from "preact-render-to-string";
import type { Heading, LayoutProps, ListProps, Page, RecordProps, Site, SiteConfig, SourcePos } from "@velella/mizzen/contracts";
import list from "../layouts/list.ts";
import doc from "../layouts/doc.ts";

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

const heading = (depth: 1 | 2, text: string): Heading => ({ depth, text, id: text.toLowerCase(), pos });

function pageWith(overrides: Partial<Page> = {}): Page {
  return {
    url: "/books/",
    source: pos,
    frontMatter: {},
    title: "Books",
    lang: "en",
    dir: "ltr",
    headings: [],
    html: "<p>Every book in the catalogue.</p>",
    markdown: "Every book in the catalogue.",
    kind: "doc",
    ...overrides,
  } as Page;
}

const book = (id: string, title: string, pages: number): RecordProps => ({
  collection: "books",
  id,
  url: `/books/${id}/`,
  fields: { title, pages },
  links: {},
});

function listProps(records: readonly RecordProps[] = [book("b", "Beta", 80), book("a", "Alpha", 120)]): ListProps {
  return { collection: "books", records, groups: [], pagination: { page: 1, total: 1 } };
}

function props(page: Page, withList = true, records?: readonly RecordProps[]): LayoutProps {
  const site: Site = {
    config,
    pages: [page],
    nav: { main: [{ title: "Books", url: "/books/" }] },
    data: {},
    collections: {},
  };
  return {
    site,
    page,
    trail: [{ title: "Books", url: "/books/" }, { title: page.title, url: page.url }],
    pager: { prev: { title: "Home", url: "/" }, next: { title: "Guide", url: "/guide/" } },
    head: { title: `${page.title} · Example`, meta: [], links: [], jsonLd: [] },
    islands: [],
    ...(withList ? { list: listProps(records) } : {}),
  } as unknown as LayoutProps;
}

const render = (page: Page, withList = true, records?: readonly RecordProps[]) =>
  renderToString(list(props(page, withList, records)) as never);
const renderDoc = (page: Page) => renderToString(doc(props(page, false)) as never);

const landmarks = (html: string) =>
  [...html.matchAll(/<(header|main|nav|aside|footer)\b[^>]*>/g)]
    .map((match) => match[0])
    // The doc layout adds the previous/next pager; the list layout does not, per its issue.
    .filter((tag) => !tag.includes('class="pager"'))
    .sort();

test("the records render below the introduction, in the engine's order", () => {
  const out = render(pageWith());
  assert.match(out, /<div class="list-intro"><p>Every book in the catalogue.<\/p><\/div>/);
  const beta = out.indexOf('/books/b/');
  const alpha = out.indexOf('/books/a/');
  assert.ok(beta > out.indexOf('class="list-intro"'), "the table follows the introduction");
  assert.ok(beta < alpha, "the layout keeps the engine's order instead of sorting");
  assert.match(out, /<th scope="col"[^>]*>title<button/);
  assert.match(out, /<th scope="col"[^>]*>pages<button/);
});

test("the title comes from the page, and the body's own h1 is not repeated", () => {
  const withoutBodyTitle = render(pageWith());
  assert.match(withoutBodyTitle, /<article class="list"[^>]*>[\s\S]*?<h1>Books<\/h1>[\s\S]*?<div class="list-intro">/);

  const withBodyTitle = render(pageWith({ headings: [heading(1, "Books"), heading(2, "Recent")] }));
  assert.equal((withBodyTitle.match(/<h1>/g) ?? []).length, 0);
});

test("a page without list data renders its body alone", () => {
  const out = render(pageWith(), false);
  assert.match(out, /<div class="list-intro"><p>Every book in the catalogue.<\/p><\/div>/);
  assert.ok(!out.includes("<table"), "no records, no table");
});

test("the list layout keeps the landmarks of the doc layout", () => {
  const page = pageWith();
  assert.deepEqual(landmarks(render(page)), landmarks(renderDoc(page)));
  assert.match(render(page), /<nav class="breadcrumb"/);
  assert.match(render(page), /<header class="site-header"/);
});

test("the list page ends with the page footer under its actions", () => {
  const out = render(pageWith());
  assert.match(out, /<div class="doc-actions"><div class="page-footer">/);
});

test("the records sit in their own region after the summaries, apart from the introduction", () => {
  const out = render(pageWith());
  const intro = out.indexOf('class="list-intro"');
  const records = out.indexOf('class="list-records"');
  const table = out.indexOf("<table");
  assert.ok(intro !== -1 && records !== -1, "the introduction and the records region both render");
  assert.ok(records > intro, "the records follow the introduction");
  assert.ok(records < table, "the records region wraps the table");
  assert.match(out, /<div class="list-records">[\s\S]*<table[\s\S]*<\/table>[\s\S]*<\/div>/, "the table is inside the records region");
  assert.equal((out.match(/class="list-records"/g) ?? []).length, 1, "the introduction's own table is not the records region");
});
