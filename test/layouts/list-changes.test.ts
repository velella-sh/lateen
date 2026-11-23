// The engine's generated changelog pages use the list layout over `<name>.changes`. The layout
// renders them as the changelog view: the engine's snapshot-date groups, an event-type badge, a
// link to the record when it still exists, the changed field, and the feed. A removed or imported
// record has no link; an empty history keeps the list's empty note.
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { test } from "node:test";
import { renderToString } from "preact-render-to-string";
import type { LayoutProps, ListGroup, ListProps, Page, RecordProps, Site, SiteConfig, SourcePos } from "@velella/mizzen/contracts";
import list from "../../layouts/list.ts";

const pos: SourcePos = { file: "changes/books/index.md", line: 1, column: 1, endLine: 1, endColumn: 1 };

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

const page: Page = {
  url: "/changes/books/",
  source: pos,
  frontMatter: {},
  title: "Books changes",
  lang: "en",
  dir: "ltr",
  headings: [],
  html: "",
  markdown: "",
  kind: "doc",
} as Page;

function change(id: string, fields: Record<string, unknown>, links: Record<string, string> = {}): RecordProps {
  return { collection: "books.changes", id, url: "", fields, links };
}

const added = change("e1", { date: "2026-05-02", type: "added", record: "alpha", field: "" }, { record: "/books/alpha/" });
const removed = change("e2", { date: "2026-04-30", type: "removed", record: "gone", field: "" });
const renamed = change("e3", { date: "2026-04-30", type: "renamed", record: "beta", from: "old-beta" }, { record: "/books/beta/" });
const fieldChanged = change("e4", { date: "2026-04-30", type: "changed", record: "gamma", field: "pages", old: 0, new: 320 }, { record: "/books/gamma/" });

const imported = change("e5", { date: "2026-04-30", type: "imported", record: "books", count: 24 });

function listProps(overrides: Partial<ListProps> = {}): ListProps {
  const groups: ListGroup[] = [
    { key: "2026-05-02", records: [added], count: 1 },
    { key: "2026-04-30", records: [removed, renamed, fieldChanged, imported], count: 4 },
  ];
  return {
    collection: "books.changes",
    records: [added, removed, renamed, fieldChanged, imported],
    groups,
    pagination: { page: 1, total: 1 },
    feed: "https://example.com/feeds/books-changes.xml",
    ...overrides,
  };
}

function props(list?: ListProps, currentPage = page): LayoutProps {
  const site: Site = {
    config,
    pages: [currentPage],
    nav: {},
    data: {},
    collections: {},
  };
  return {
    site,
    page: currentPage,
    trail: [{ title: page.title, url: page.url }],
    pager: {},
    head: { title: page.title, meta: [], links: [], jsonLd: [] },
    islands: [],
    ...(list === undefined ? {} : { list }),
  } as unknown as LayoutProps;
}

const htmlOf = (data?: ListProps): string => renderToString(list(props(data)) as never);

test("two snapshot dates render as two sections with badges", () => {
  const html = htmlOf(listProps());
  assert.ok(html.includes("2 May 2026"));
  assert.ok(html.includes("30 April 2026"));
  assert.ok(html.includes("changes-group"));
  assert.ok(html.includes(">Added</span>"));
  assert.ok(html.includes(">Removed</span>"));
  assert.ok(!html.includes("<table"));
});

test("a removed record has no link, while a renamed record keeps one", () => {
  const html = htmlOf(listProps());
  assert.ok(html.includes(">gone</span>"));
  assert.ok(html.includes('href="/books/beta/"'));
  assert.ok(html.includes(">Renamed</span>"));
  assert.ok(html.includes('href="/books/alpha/"'));
});

test("changelog rows show changed values, earlier record ids, and import counts", () => {
  const document = new JSDOM(htmlOf(listProps())).window.document;
  const row = document.querySelector('a[href="/books/gamma/"]')?.closest("li");
  assert.equal(row?.querySelector(".changes-field")?.textContent, "pages");
  assert.equal(row?.querySelector("del bdi")?.textContent, "0");
  assert.equal(row?.querySelector("ins bdi")?.textContent, "320");
  assert.match(document.querySelector('a[href="/books/beta/"]')?.closest("li")?.textContent ?? "", /Renamed from old-beta/);
  assert.match([...document.querySelectorAll(".changes-item")].at(-1)?.textContent ?? "", /24 records/);
});

test("localized RTL change arrows follow reading order", () => {
  for (const lang of ["fa", "ar"]) {
    const html = renderToString(list(props(listProps(), { ...page, lang, dir: "rtl" })) as never);
    const document = new JSDOM(html).window.document;
    assert.equal(document.querySelector(".record-history-arrow")?.textContent, "←");
    assert.equal(document.querySelector("del bdi")?.textContent, "0");
  }
});

test("the page links its Atom feed", () => {
  const html = htmlOf(listProps());
  assert.ok(html.includes("list-feed"));
  assert.ok(html.includes('href="https://example.com/feeds/books-changes.xml"'));
});

test("an empty history keeps the empty note and draws no rows", () => {
  const { feed: _feed, ...rest } = listProps();
  const html = htmlOf({ ...rest, records: [], groups: [] });
  assert.ok(html.includes("state-empty"));
  assert.ok(!html.includes("changes-list"));
  assert.ok(!html.includes("list-feed"));
});
