import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToString } from "preact-render-to-string";
import type { LayoutProps, ListPagination, ListProps, Page, RecordProps, Site, SiteConfig, SourcePos } from "@velella/mizzen/contracts";
import list from "../layouts/list.ts";

const pos: SourcePos = { file: "posts/index.md", line: 1, column: 1, endLine: 1, endColumn: 1 };

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

const record = (id: string, fields: RecordProps["fields"]): RecordProps => ({
  collection: "posts",
  id,
  url: `/posts/${id}/`,
  fields,
  links: {},
});

const POSTS = [
  record("first", { title: "First post", published: "2026-01-02", status: "stable" }),
  record("second", { title: "Second post", published: "2026-01-20" }),
  record("third", { title: "Third post", published: "2026-02-01" }),
];

function render(
  records: readonly RecordProps[] = POSTS,
  frontMatter: Record<string, unknown> = { list: { collection: "posts", view: "dated", date: "published" } },
  pagination: ListPagination = { page: 1, total: 1 },
  lang = "en",
): string {
  const page = {
    url: "/posts/",
    source: pos,
    frontMatter,
    title: "Posts",
    lang,
    dir: lang === "en" ? "ltr" : "rtl",
    headings: [],
    html: "<p>Everything we published.</p>",
    markdown: "Everything we published.",
    kind: "doc",
  } as Page;
  const data: ListProps = { collection: "posts", records, groups: [], pagination };
  const site: Site = { config, pages: [page], nav: {}, data: {}, collections: {} };
  const props = {
    site,
    page,
    trail: [],
    pager: {},
    head: { title: "Posts · Example", meta: [], links: [], jsonLd: [] },
    islands: [],
    list: data,
  } as unknown as LayoutProps;
  return renderToString(list(props) as never);
}

test("the dated view groups records by the field `list.date` names, newest order as the engine gave it", () => {
  const out = render();
  assert.match(out, /class="dated-list/);
  assert.doesNotMatch(out, /<table/);
  assert.match(out, /<h2[^>]*>January 2026<\/h2>/);
  assert.match(out, /<h2[^>]*>February 2026<\/h2>/);
  assert.ok(out.indexOf("January 2026") < out.indexOf("February 2026"), "oldest month first");
  assert.match(out, /href="\/posts\/first\/"[^>]*>First post</);
  assert.match(out, /Third post/);
});

test("the view reads the field the page names, and a missing date goes to the visible invalid section", () => {
  const out = render([record("first", { title: "First post", published: "2026-01-02" }), record("undated", { title: "Undated" })]);
  assert.match(out, /January 2026/);
  assert.match(out, /class="dated-list-invalid"/);
  assert.match(out, /Undated/);
});

test("a page with one date still renders one month", () => {
  const out = render([record("only", { title: "Only post", published: "2026-03-04" })]);
  assert.match(out, /March 2026/);
  assert.doesNotMatch(out, /dated-list-invalid/);
});

test("a paginated dated list says the dates continue, and the last page says nothing", () => {
  const first = render(POSTS.slice(0, 2), undefined, { page: 1, total: 2, next: "/posts/page/2/" });
  assert.match(first, /<p class="list-dated-continues">Dates continue on page 2\.<\/p>/);
  assert.match(first, /class="pagination"/);

  const last = render([POSTS[2]!], undefined, { page: 2, total: 2, previous: "/posts/" });
  assert.doesNotMatch(last, /list-dated-continues/);
  assert.match(last, /class="pagination"/);
});

test("a long dated archive gets a table of contents whose links reach every month heading", () => {
  const long = [
    record("jan-a", { title: "January one", published: "2026-01-02" }),
    record("jan-b", { title: "January two", published: "2026-01-19" }),
    record("feb", { title: "February", published: "2026-02-03" }),
    record("mar", { title: "March", published: "2026-03-04" }),
    record("apr", { title: "April", published: "2026-04-05" }),
  ];
  const out = render(long);
  const toc = out.match(/<nav class="dated-list-toc"[^>]*>([\s\S]*?)<\/nav>/)?.[1];
  assert.ok(toc, "the table of contents is in the HTML");
  const links = [...toc.matchAll(/<a href="#([^"]+)">([^<]+)<\/a>/g)].map((match) => match[1]!);
  assert.equal(links.length, 4, "one link per month, not per record");
  const ids = [...out.matchAll(/<section class="dated-list-group"><h2 id="([^"]+)">/g)].map((match) => match[1]!);
  assert.deepEqual(links, ids, "every link reaches its own heading, in heading order");
  assert.equal(new Set(ids).size, ids.length, "no heading id repeats");
  assert.doesNotMatch(toc, /<script|onclick/, "the table works without JavaScript");

  assert.doesNotMatch(render(POSTS), /dated-list-toc/, "a short archive keeps its list alone");
});

test("the note follows the page language", () => {
  assert.match(render(POSTS.slice(0, 2), undefined, { page: 1, total: 2, next: "/posts/page/2/" }, "fa"), /تاریخ‌ها در صفحهٔ ۲ ادامه دارند\./);
});
