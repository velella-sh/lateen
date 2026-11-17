import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToString } from "preact-render-to-string";
import type { LayoutProps, ListGroup, ListProps, Page, RecordProps, Site, SiteConfig, SourcePos } from "@velella/mizzen/contracts";
import list from "../layouts/list.ts";

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

function pageWith(frontMatter: Record<string, unknown> = {}): Page {
  return {
    url: "/books/",
    source: pos,
    frontMatter,
    title: "Books",
    lang: "en",
    dir: "ltr",
    headings: [],
    html: "<p>Every book in the catalogue.</p>",
    markdown: "Every book in the catalogue.",
    kind: "doc",
  } as Page;
}

const book = (id: string, fields: RecordProps["fields"]): RecordProps => ({
  collection: "books",
  id,
  url: `/books/${id}/`,
  fields,
  links: {},
});

const beta = book("b", { title: "Beta", summary: "A short book.", status: "done", pages: 80, author: "Ada", year: 2021, extra: "hidden" });
const alpha = book("a", { title: "Alpha", summary: "A long book.", status: "draft", pages: 120 });
const gamma = book("c", { title: "Gamma", pages: 200 });

function props(page: Page, listData?: ListProps): LayoutProps {
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
    ...(listData === undefined ? {} : { list: listData }),
  } as unknown as LayoutProps;
}

const ungrouped = (records: readonly RecordProps[], page = 1, total = 1): ListProps => ({
  collection: "books",
  records,
  groups: [],
  pagination: { page, total, ...(total > 1 ? { next: "/books/page/2/" } : {}) },
});

const grouped = (groups: readonly ListGroup[]): ListProps => ({
  collection: "books",
  records: groups.flatMap((group) => group.records),
  groups,
  pagination: { page: 1, total: 1 },
});

const render = (page: Page, listData: ListProps) => renderToString(list(props(page, listData)) as never);
const cardsOf = (html: string) => html.slice(html.indexOf('<div class="cards">'));

test("without list.view the page keeps the record table", () => {
  const out = render(pageWith(), ungrouped([beta, alpha]));
  assert.match(out, /<table/);
  assert.doesNotMatch(out, /class="cards"/);
});

test("list.view: cards renders one card per record with title, summary, status, and three facts", () => {
  const out = render(pageWith({ list: { view: "cards" } }), ungrouped([beta, alpha]));
  assert.doesNotMatch(out, /<table/, "no table in the cards view");
  const grid = cardsOf(out);
  assert.equal((grid.match(/class="card"/g) ?? []).length, 2, "one card per record");
  assert.ok(grid.indexOf("/books/b/") < grid.indexOf("/books/a/"), "the engine's order");

  assert.match(grid, /<a class="card" href="\/books\/b\/">/);
  assert.match(grid, /<span class="card-title">Beta<\/span>/);
  assert.match(grid, /<span class="card-description">A short book.<\/span>/);
  assert.match(grid, /<span class="list-card-status">done<\/span>/);
  assert.match(grid, /<dt>pages<\/dt><dd>80<\/dd>/);
  assert.match(grid, /<dt>author<\/dt><dd>Ada<\/dd>/);
  assert.match(grid, /<dt>year<\/dt><dd>2021<\/dd>/);
  assert.doesNotMatch(grid, /<dt>extra<\/dt>/, "a fourth fact is left out");
});

test("cards with groups keep one section per group and only that group's records", () => {
  const out = render(
    pageWith({ list: { view: "cards" } }),
    grouped([
      { key: "Fiction", records: [beta] },
      { key: "Poetry", records: [alpha, gamma], count: 9 },
    ]),
  );
  const sections = [...out.matchAll(/<section class="list-group">([\s\S]*?)<\/section>/g)].map((match) => match[1]!);
  assert.equal(sections.length, 2, "one section per group");
  assert.match(sections[0]!, /<h2 id="fiction">Fiction <span class="list-group-count">1<\/span><\/h2>/);
  assert.match(sections[1]!, /<h2 id="poetry">Poetry <span class="list-group-count">9<\/span><\/h2>/);
  assert.equal(cardsOf(sections[0]!).match(/class="card"/g)?.length, 1, "one card in the first group");
  assert.match(sections[0]!, /\/books\/b\//);
  assert.doesNotMatch(sections[0]!, /\/books\/a\//);
  assert.equal(cardsOf(sections[1]!).match(/class="card"/g)?.length, 2, "two cards in the second group");
  assert.match(sections[1]!, /\/books\/a\//);
  assert.match(sections[1]!, /\/books\/c\//);
});

test("pagination renders in both views", () => {
  const table = render(pageWith(), ungrouped([beta], 1, 2));
  const cards = render(pageWith({ list: { view: "cards" } }), ungrouped([beta], 1, 2));
  for (const out of [table, cards]) {
    assert.match(out, /<nav class="pagination"/);
    assert.match(out, /href="\/books\/page\/2\/"/, "page two is linked");
    assert.match(out, /rel="next"/);
  }
});

test("a missing or unknown list.view falls back to the table", () => {
  for (const frontMatter of [{}, { list: {} }, { list: { view: "table" } }, { list: { view: "grid" } }, { list: "cards" }]) {
    const out = render(pageWith(frontMatter), ungrouped([beta]));
    assert.match(out, /<table/, JSON.stringify(frontMatter));
    assert.doesNotMatch(out, /class="cards"/, JSON.stringify(frontMatter));
  }
});
