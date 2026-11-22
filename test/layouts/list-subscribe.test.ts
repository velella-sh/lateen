// A list page that belongs to a calendar shows a subscribe panel: the webcal link, the https
// address as selectable text, a copy button the island reveals, and one row per group when the
// page groups. A list without a calendar renders none of it and loads no island.
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
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
  fields: { title: "Alpha", date: "2026-04-10" },
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

test("a grouped dated list offers every collection and group calendar once", () => {
  const group = (key: string): ListGroup => ({
    key,
    records: [book],
    count: 1,
    calendars: [
      calendar(`books-${key}`, `Books (${key})`),
      calendar(`releases-${key}`, `Releases (${key})`),
    ],
  });
  const data = listProps({
    calendars: [calendar("books", "Books"), calendar("releases", "Releases")],
    groups: [group("novel"), group("poetry")],
  });
  const input = props(data);
  const html = renderToString(list({
    ...input,
    page: { ...page, frontMatter: { list: { view: "dated", date: "date" } } },
  }) as never);
  const doc = new JSDOM(html).window.document;
  const names = ["books", "releases", "books-novel", "releases-novel", "books-poetry", "releases-poetry"];
  assert.deepEqual([...doc.querySelectorAll(".list-subscribe-list li")].map((row) => [
    row.querySelector("a[href^='webcal:']")?.getAttribute("href"),
    row.querySelector("a[download]")?.getAttribute("href"),
  ]), names.map((name) => [
    `webcal://example.com/calendars/${name}.ics`,
    `https://example.com/calendars/${name}.ics`,
  ]));
  assert.equal(doc.querySelectorAll('a[href="https://example.com/calendars/books.ics"]').length, 1);
  assert.match(doc.querySelector(".list-subscribe-list li:last-child")!.textContent ?? "", /Releases \(poetry\)/);
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
