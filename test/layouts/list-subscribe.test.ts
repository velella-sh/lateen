// A list page that belongs to a calendar shows a subscribe panel: the webcal link, the https
// address as selectable text, a copy button the island reveals, and one row per group when the
// page groups. A list without a calendar renders none of it and loads no island.
import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToString } from "preact-render-to-string";
import type { CalendarLink, LayoutProps, ListGroup, ListProps, Page, RecordProps, Site, SiteConfig, SourcePos } from "@velella/mizzen/contracts";
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

const page: Page = {
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
} as Page;

const book: RecordProps = {
  collection: "books",
  id: "a",
  url: "/books/a/",
  fields: { title: "Alpha" },
  links: {},
};

const calendar = (name: string, title: string): CalendarLink => ({
  name,
  title,
  url: `https://example.com/calendars/${name}.ics`,
  webcal: `webcal://example.com/calendars/${name}.ics`,
});

function listProps(overrides: Partial<ListProps> = {}): ListProps {
  return { collection: "books", records: [book], groups: [], pagination: { page: 1, total: 1 }, ...overrides };
}

function props(list?: ListProps): LayoutProps {
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
    trail: [{ title: "Books", url: "/books/" }],
    pager: {},
    head: { title: "Books · Example", meta: [], links: [], jsonLd: [] },
    islands: [],
    ...(list === undefined ? {} : { list }),
  } as unknown as LayoutProps;
}

test("one calendar shows the webcal link, the address as text, and a hidden copy button", () => {
  const html = renderToString(list(props(listProps({ calendars: [calendar("books", "Books")] }))) as never);
  assert.ok(html.includes("data-list-subscribe"));
  assert.ok(html.includes('href="webcal://example.com/calendars/books.ics"'));
  assert.ok(html.includes("https://example.com/calendars/books.ics"));
  assert.ok(html.includes("data-calendar-copy"));
  assert.ok(/<button[^>]*hidden[^>]*data-calendar-copy/.test(html));
  assert.ok(html.includes('role="status"'));
  assert.ok(html.includes("assets/theme/islands/components/add-to-calendar/client.js"));
});

test("a grouped list gets one subscribe link per group", () => {
  const group = (key: string): ListGroup => ({
    key,
    records: [book],
    count: 1,
    calendars: [calendar(`books-${key}`, `Books (${key})`)],
  });
  const html = renderToString(list(props(listProps({ groups: [group("novel"), group("poetry")] }))) as never);
  assert.ok(html.includes("Books (novel)"));
  assert.ok(html.includes("Books (poetry)"));
  assert.ok(html.includes("books-novel.ics"));
  assert.ok(html.includes("books-poetry.ics"));
});

test("a list without a calendar renders no panel and loads no subscribe island", () => {
  const html = renderToString(list(props(listProps())) as never);
  assert.ok(!html.includes("data-list-subscribe"));
  assert.ok(!html.includes("add-to-calendar/client.js"));
});

test("without JavaScript the address is visible text and the button stays hidden", () => {
  const html = renderToString(list(props(listProps({ calendars: [calendar("books", "Books")] }))) as never);
  assert.ok(html.includes("list-subscribe-address"));
  assert.ok(/<code[^>]*dir="ltr"[^>]*>[\s\S]*https:\/\/example\.com\/calendars\/books\.ics/.test(html));
  assert.ok(/<button[^>]*hidden[^>]*>Copy<\/button>/.test(html));
});

test("an unsafe address is left out of the panel", () => {
  const unsafe = [{ name: "books", title: "Books", url: "javascript:alert(1)", webcal: "webcal://example.com/x.ics" }];
  const html = renderToString(list(props(listProps({ calendars: unsafe }))) as never);
  assert.ok(!html.includes("javascript:"));
  assert.ok(!html.includes("data-list-subscribe"));
});
