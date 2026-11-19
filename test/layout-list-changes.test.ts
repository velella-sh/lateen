// The engine's generated changelog pages use the list layout over `<name>.changes`. The layout
// renders them as the changelog view: the engine's snapshot-date groups, an event-type badge, a
// link to the record when it still exists, the changed field, and the feed. A removed or imported
// record has no link; an empty history keeps the list's empty note.
import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToString } from "preact-render-to-string";
import type { LayoutProps, ListGroup, ListProps, Page, RecordProps, Site, SiteConfig, SourcePos } from "@velella/mizzen/contracts";
import list from "../layouts/list.ts";

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
const renamed = change("e3", { date: "2026-04-30", type: "renamed", record: "beta", field: "" }, { record: "/books/beta/" });
const fieldChanged = change("e4", { date: "2026-04-30", type: "changed", record: "gamma", field: "pages" }, { record: "/books/gamma/" });

function listProps(overrides: Partial<ListProps> = {}): ListProps {
  const groups: ListGroup[] = [
    { key: "2026-05-02", records: [added], count: 1 },
    { key: "2026-04-30", records: [removed, renamed, fieldChanged], count: 3 },
  ];
  return {
    collection: "books.changes",
    records: [added, removed, renamed, fieldChanged],
    groups,
    pagination: { page: 1, total: 1 },
    feed: "https://example.com/feeds/books-changes.xml",
    ...overrides,
  };
}

function props(list?: ListProps): LayoutProps {
  const site: Site = {
    config,
    pages: [page],
    nav: {},
    data: {},
    collections: {},
  };
  return {
    site,
    page,
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
  assert.ok(html.includes("May 2, 2026"));
  assert.ok(html.includes("April 30, 2026"));
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

test("a changed field is named beside its record", () => {
  const html = htmlOf(listProps());
  assert.ok(html.includes("changes-field"));
  assert.ok(html.includes(">pages</code>"));
  assert.ok(html.includes('href="/books/gamma/"'));
});

test("the page links its Atom feed", () => {
  const html = htmlOf(listProps());
  assert.ok(html.includes("list-feed"));
  assert.ok(html.includes('href="https://example.com/feeds/books-changes.xml"'));
});

test("an empty history keeps the empty note and draws no rows", () => {
  const { feed: _feed, ...rest } = listProps();
  const html = htmlOf({ ...rest, records: [], groups: [] });
  assert.ok(html.includes("list-empty"));
  assert.ok(!html.includes("changes-list"));
  assert.ok(!html.includes("list-feed"));
});
