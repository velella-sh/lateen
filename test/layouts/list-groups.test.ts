import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToString } from "preact-render-to-string";
import type { Heading, LayoutProps, ListGroup, ListProps, Page, RecordProps, Site, SiteConfig, SourcePos } from "@velella/mizzen/contracts";
import listLayout from "../../layouts/list.ts";

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

const heading = (depth: 1 | 2, id: string, text: string): Heading => ({ depth, id, text, pos });

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

const fiction = book("b", "Beta", 80);
const poetry = book("a", "Alpha", 120);
const drama = book("c", "Gamma", 200);

function groups(list: readonly ListGroup[]): ListProps {
  const records = list.flatMap((group) => group.records);
  return { collection: "books", records, groups: list, pagination: { page: 1, total: 1 } };
}

function props(page: Page, list?: ListProps, base = ""): LayoutProps {
  const site: Site = {
    config: { ...config, base },
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
    ...(list === undefined ? {} : { list }),
  } as unknown as LayoutProps;
}

const render = (page: Page, list: ListProps, base = "") => renderToString(listLayout(props(page, list, base)) as never);

const summaryOf = (html: string) => html.match(/<nav class="list-group-summary">([\s\S]*?)<\/nav>/)?.[1];
const summaryLinks = (html: string) =>
  [...(summaryOf(html) ?? "").matchAll(/<a href="([^"]*)">([^<]*) <span class="list-group-count">([^<]*)<\/span><\/a>/g)].map(
    (match) => ({ href: match[1]!, name: match[2]!, count: match[3]! }),
  );

const grouped = groups([
  { key: "Fiction", records: [fiction] },
  { key: "Poetry", records: [poetry, drama], count: 9 },
]);

test("each group renders as a section with its heading, count, and own table, in the engine's order", () => {
  const out = render(pageWith(), grouped);
  const sections = [...out.matchAll(/<section class="list-group">([\s\S]*?)<\/section>/g)].map((match) => match[1]!);
  assert.equal(sections.length, 2, "one section per group");
  assert.match(sections[0]!, /<h2 id="fiction">/, "sections keep the engine's order");
  assert.match(sections[1]!, /<h2 id="poetry">/);
  assert.match(sections[0]!, /<h2 id="fiction">Fiction <span class="list-group-count">1<\/span><\/h2>/);
  assert.match(sections[1]!, /<h2 id="poetry">Poetry <span class="list-group-count">9<\/span><\/h2>/);
  assert.equal((sections[0]!.match(/<table/g) ?? []).length, 1, "one table in the first group");
  assert.equal((sections[1]!.match(/<table/g) ?? []).length, 1, "one table in the second group");
  assert.match(sections[0]!, /\/books\/b\//);
  assert.doesNotMatch(sections[0]!, /\/books\/a\//, "a group's table holds only its records");
  assert.match(sections[1]!, /\/books\/a\//);
  assert.match(sections[1]!, /\/books\/c\//);
});

test("group headings are appended to the table of contents without touching the page", () => {
  const page = pageWith({ headings: [heading(1, "books", "Books"), heading(2, "recent", "Recent")] });
  const out = render(page, grouped);
  assert.deepEqual(page.headings.map((item) => item.id), ["books", "recent"], "the page keeps its own headings");

  const aside = out.slice(out.indexOf('<div class="aside">'));
  assert.match(aside, /href="#recent"/);
  assert.match(aside, /href="#fiction"/);
  assert.match(aside, /href="#poetry"/);
  assert.ok(aside.indexOf("#recent") < aside.indexOf("#fiction"), "group headings follow the page's own");
});

test("duplicate group keys get stable, distinct ids that the TOC shares", () => {
  const out = render(pageWith(), groups([
    { key: "Same", records: [fiction] },
    { key: "Same", records: [poetry] },
  ]));
  assert.match(out, /<h2 id="same">Same /);
  assert.match(out, /<h2 id="same-2">Same /);
  assert.match(out, /href="#same"/);
  assert.match(out, /href="#same-2"/);
});

test("an ungrouped list keeps the single table and no group sections", () => {
  const out = render(pageWith(), {
    collection: "books",
    records: [fiction, poetry],
    groups: [],
    pagination: { page: 1, total: 1 },
  });
  assert.equal((out.match(/<table/g) ?? []).length, 1, "one table");
  assert.doesNotMatch(out, /<section class="list-group"/);
  assert.doesNotMatch(out, /list-group-count/);
});

test("the outline is the page h1 then one h2 per group", () => {
  const out = render(pageWith(), grouped);
  const article = out.slice(out.indexOf('<article class="list"'), out.indexOf("</article>") + "</article>".length);
  const outline = [...article.matchAll(/<(h[1-6])(?: id="([^"]*)")?[^>]*>([^<]*)/g)].map((match) => `${match[1]}:${match[2] ?? ""}:${match[3]!.trim()}`);
  assert.deepEqual(outline, ["h1::Books", "h2:fiction:Fiction", "h2:poetry:Poetry"]);
});

test("groups with their own pages render linked summaries before the records, in the engine's order", () => {
  const out = render(pageWith(), groups([
    { key: "Fiction", records: [fiction], count: 4, url: "/books/fiction/" },
    { key: "Poetry", records: [poetry, drama], count: 9, url: "/books/poetry/" },
  ]));
  assert.deepEqual(summaryLinks(out), [
    { href: "/books/fiction/", name: "Fiction", count: "4" },
    { href: "/books/poetry/", name: "Poetry", count: "9" },
  ]);
  assert.ok(out.indexOf('<nav class="list-group-summary">') < out.indexOf("<table"), "the summaries come first");
});

test("groups without a page link to their own section anchor", () => {
  const out = render(pageWith(), grouped);
  assert.deepEqual(summaryLinks(out), [
    { href: "#fiction", name: "Fiction", count: "1" },
    { href: "#poetry", name: "Poetry", count: "9" },
  ]);
});

test("an empty group is left out of the summaries, and no summaries are drawn when every group is empty", () => {
  const partlyEmpty = render(pageWith(), groups([
    { key: "Empty", records: [], count: 0 },
    { key: "Fiction", records: [fiction] },
  ]));
  assert.deepEqual(summaryLinks(partlyEmpty), [{ href: "#fiction", name: "Fiction", count: "1" }]);

  const allEmpty = render(pageWith(), groups([{ key: "Empty", records: [], count: 0 }]));
  assert.equal(summaryOf(allEmpty), undefined);
});

test("the summaries keep the site base and the page's right-to-left direction", () => {
  const out = render(
    pageWith({ lang: "fa", dir: "rtl", title: "کتاب‌ها" }),
    groups([
      { key: "داستان", records: [fiction], count: 4, url: "/example/books/fiction/" },
      { key: "شعر", records: [poetry], count: 9, url: "/example/books/poetry/" },
    ]),
    "/example",
  );
  assert.deepEqual(summaryLinks(out).map((link) => link.name), ["داستان", "شعر"], "the summaries keep the engine's order");
  assert.match(out, /href="\/example\/books\/fiction\/"/);
  assert.doesNotMatch(out, /\/example\/example\//, "a URL that already carries the base is not prefixed twice");
  assert.match(out, /<html lang="fa" dir="rtl"/);
  assert.doesNotMatch(summaryOf(out)!, /dir="ltr"/, "the summary adds no direction of its own");
});

test("the summaries are ordinary server-rendered links that work without JavaScript", () => {
  const out = render(pageWith(), grouped);
  const summary = summaryOf(out);
  assert.ok(summary, "the summaries are in the HTML");
  assert.match(summary, /<a href="#fiction">Fiction <span class="list-group-count">1<\/span><\/a>/);
  assert.match(summary, /<a href="#poetry">Poetry <span class="list-group-count">9<\/span><\/a>/);
  assert.doesNotMatch(summary, /<script|onclick|data-island/, "no client code is needed");
});
