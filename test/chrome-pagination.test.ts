import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { renderToString } from "preact-render-to-string";
import type { ListPagination, ListProps, Page, Site, SiteConfig, SourcePos } from "@velella/mizzen/contracts";
import pagination, { paginationLinks } from "../chrome/pagination/index.ts";
import listLayout from "../layouts/list.ts";

function output(links: ListPagination, url = "/books/", lang = "en"): string {
  const node = pagination({ url, lang, pagination: links });
  return node === null ? "" : renderToString(node as never);
}

/** Runs `run` while collecting everything written to `console.warn`. */
function warningsFrom(run: () => void): string[] {
  const warnings: string[] = [];
  const warn = console.warn;
  console.warn = (...args: unknown[]) => warnings.push(args.map(String).join(" "));
  try {
    run();
  } finally {
    console.warn = warn;
  }
  return warnings;
}

const names = JSON.parse(readFileSync(new URL("../tokens/names.json", import.meta.url), "utf8")) as Record<
  string,
  Record<string, unknown>
>;
const tokenNames = new Set(
  Object.entries(names).flatMap(([group, entries]) => Object.keys(entries).map((name) => `${group}-${name}`)),
);

const MESSAGES = {
  en: { nav: "Pagination", page: "Page 2", previous: "Previous", next: "Next" },
  fa: { nav: "صفحه‌بندی", page: "صفحهٔ 2", previous: "قبلی", next: "بعدی" },
  ar: { nav: "ترقيم الصفحات", page: "الصفحة 2", previous: "السابق", next: "التالي" },
} as const;

const middle: ListPagination = { page: 2, total: 3, previous: "/books/", next: "/books/page/3/" };

test("renders nothing on a list that fits on one page", () => {
  assert.equal(output({ page: 1, total: 1 }), "");
});

test("the first page links the next page and lays out every page number", () => {
  const out = output({ page: 1, total: 3, next: "/books/page/2/" });

  assert.match(out, /^<nav class="pagination" aria-label="Pagination">/);
  assert.doesNotMatch(out, /pagination-prev|rel="prev"/);
  assert.match(out, /<a class="pagination-link pagination-next" href="\/books\/page\/2\/" rel="next">/);

  const pages = [...out.matchAll(/<a class="pagination-link pagination-page" href="([^"]+)" aria-label="Page (\d+)"(?: aria-current="page")?>(\d+)<\/a>/g)];
  assert.deepEqual(pages.map((match) => match[2]), ["1", "2", "3"]);
  assert.deepEqual(pages.map((match) => match[1]), ["/books/", "/books/page/2/", "/books/page/3/"]);
  assert.deepEqual(pages.map((match) => match[0]?.includes('aria-current="page"')), [true, false, false]);
  assert.match(out, /href="\/books\/" aria-label="Page 1" aria-current="page">1<\/a>/);
});

test("a first page URL without a trailing slash still builds later pages under it", () => {
  const out = output({ page: 1, total: 2, next: "/books/page/2/" }, "/books");
  assert.match(out, /href="\/books" aria-label="Page 1" aria-current="page">1<\/a>/);
  assert.match(out, /href="\/books\/page\/2\/" aria-label="Page 2">2<\/a>/);
});

test("a middle page links both neighbours and marks the current page once", () => {
  const out = output(middle, "/books/page/2/");

  assert.match(out, /<a class="pagination-link pagination-prev" href="\/books\/" rel="prev">/);
  assert.match(out, /<a class="pagination-link pagination-next" href="\/books\/page\/3\/" rel="next">/);
  assert.equal(out.match(/aria-current="page"/g)?.length, 1);
  assert.match(out, /href="\/books\/page\/2\/" aria-label="Page 2" aria-current="page">2<\/a>/);
});

test("the last page has no next link and marks the last number current", () => {
  const out = output({ page: 3, total: 3, previous: "/books/page/2/" }, "/books/page/3/");

  assert.match(out, /pagination-prev" href="\/books\/page\/2\/" rel="prev"/);
  assert.doesNotMatch(out, /pagination-next|rel="next"/);
  assert.match(out, /href="\/books\/page\/3\/" aria-label="Page 3" aria-current="page">3<\/a>/);
});

test("a long range keeps the ends and the current page, with gaps that are not links", () => {
  const out = output(
    { page: 10, total: 20, previous: "/books/page/9/", next: "/books/page/11/" },
    "/books/page/10/",
  );

  const sequence = [
    ...out.matchAll(
      /<a class="pagination-link pagination-page"[^>]*>(\d+)<\/a>|<span class="pagination-gap"[^>]*>…<\/span>/g,
    ),
  ].map((match) => match[1] ?? "…");
  assert.deepEqual(sequence, ["1", "…", "9", "10", "11", "…", "20"]);
  assert.equal((out.match(/class="pagination-gap"/g) ?? []).length, 2);
  assert.match(out, /<span class="pagination-gap" aria-hidden="true">…<\/span>/);
  assert.doesNotMatch(out, /<a[^>]*>…<\/a>/);
});

test("the navigation and page labels read from every shipped catalog without a diagnostic", () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";
  try {
    for (const [lang, messages] of Object.entries(MESSAGES)) {
      let out = "";
      assert.deepEqual(
        warningsFrom(() => {
          out = output(middle, "/books/page/2/", lang);
        }),
        [],
        `${lang} reads only shipped messages`,
      );
      assert.ok(out.includes(`aria-label="${messages.nav}"`), `${lang} nav label`);
      assert.ok(out.includes(`aria-label="${messages.page}"`), `${lang} page label`);
      assert.ok(out.includes(messages.previous), `${lang} previous label`);
      assert.ok(out.includes(messages.next), `${lang} next label`);
    }
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
});

test("escaping keeps URLs as attributes", () => {
  const out = output({ page: 2, total: 3, previous: '/a?x=1&y="2"', next: "/b/</script>" }, "/books/page/2/");

  assert.match(out, /href="\/a\?x=1&amp;y=&quot;2&quot;"/);
  assert.doesNotMatch(out, /<\/script>/);
});

test("the head links carry rel=prev and rel=next only when that page exists", () => {
  assert.deepEqual(paginationLinks({ page: 1, total: 1 }), []);
  assert.deepEqual(paginationLinks({ page: 1, total: 3, next: "/books/page/2/" }), [
    { rel: "next", href: "/books/page/2/" },
  ]);
  assert.deepEqual(paginationLinks({ page: 3, total: 3, previous: "/books/page/2/" }), [
    { rel: "prev", href: "/books/page/2/" },
  ]);
  assert.deepEqual(paginationLinks(middle), [
    { rel: "prev", href: "/books/" },
    { rel: "next", href: "/books/page/3/" },
  ]);
});

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

test("the list layout draws the unit after the records and adds the head links", () => {
  const page: Page = {
    url: "/books/page/2/",
    source: pos,
    frontMatter: {},
    title: "Books",
    lang: "en",
    dir: "ltr",
    headings: [],
    html: "",
    markdown: "",
    kind: "doc",
  };
  const site: Site = {
    config,
    pages: [page],
    nav: { main: [{ title: "Books", url: "/books/" }] },
    data: {},
    collections: {},
  };
  const list: ListProps = { collection: "books", records: [], groups: [], pagination: middle };
  const html = renderToString(
    listLayout({
      site,
      page,
      trail: [{ title: "Books", url: "/books/" }],
      pager: {},
      head: { title: "Books", meta: [], links: [], jsonLd: [] },
      islands: [],
      list,
    } as never) as never,
  );

  const article = html.slice(html.indexOf('<article class="list"'), html.indexOf("</article>"));
  assert.match(article, /<nav class="pagination" aria-label="Pagination">/);
  assert.match(article, /pagination-next" href="\/books\/page\/3\/" rel="next"/);
  assert.match(html, /<link rel="prev" href="\/books\/"\s*\/?>/);
  assert.match(html, /<link rel="next" href="\/books\/page\/3\/"\s*\/?>/);
});

