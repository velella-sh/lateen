import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToString } from "preact-render-to-string";
import type { LayoutProps, ListProps, Page, RecordProps, Site, SiteConfig, SourcePos } from "@velella/mizzen/contracts";
import gallery from "../layouts/gallery.ts";

const pos: SourcePos = { file: "gallery.md", line: 1, column: 1, endLine: 1, endColumn: 1 };

const records: RecordProps[] = [
  {
    collection: "books",
    id: "alpha",
    url: "/books/alpha/",
    fields: { title: "Alpha", status: "done", published: "2026-01-02" },
    links: {},
  },
  {
    collection: "books",
    id: "beta",
    url: "/books/beta/",
    fields: { title: "Beta", status: "draft", published: "2026-01-01" },
    links: {},
  },
  {
    collection: "books",
    id: "gamma",
    url: "/books/gamma/",
    fields: { title: "Gamma", status: "done", published: "2026-02-01" },
    links: {},
  },
];

function props(
  url: string,
  lang = "en",
  search: Readonly<Record<string, unknown>> = { filters: ["status"], sort: ["published", "title"] },
): LayoutProps {
  const config = {
    title: "Example",
    base: "",
    lang,
    dir: lang === "en" ? "ltr" : "rtl",
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
    collections: { books: { source: "_data/books.json", id: "id", search } },
    feeds: {},
  } as unknown as SiteConfig;
  const page = {
    url,
    source: pos,
    frontMatter: {},
    title: "Gallery",
    lang,
    dir: lang === "en" ? "ltr" : "rtl",
    headings: [],
    html: "",
    markdown: "",
    kind: "doc",
  } as Page;
  const site = { config, pages: [page], nav: {}, data: {}, collections: {} } as unknown as Site;
  const list: ListProps = {
    collection: "books",
    records,
    groups: [],
    pagination: { page: 1, total: 1 },
  };
  return {
    site,
    page,
    trail: [],
    pager: {},
    head: { title: "Gallery · Example", meta: [], links: [], jsonLd: [] },
    islands: [],
    list,
  } as unknown as LayoutProps;
}

const render = (subject: LayoutProps): string => renderToString(gallery(subject) as never);
const cards = (out: string): string[] =>
  [...out.matchAll(/<a class="card" href="([^"]*)">/g)].map((match) => match[1] ?? "");

test("the first declared sort key is the default and orders the grid", () => {
  const out = render(props("/gallery/"));
  assert.deepEqual(cards(out), ["/books/beta/", "/books/alpha/", "/books/gamma/"]);
  assert.match(out, /class="gallery-count"[^>]*>Showing 3 of 3<\/p>/);
  assert.match(out, /<a[^>]*data-gallery-sort="published"[^>]*aria-current="true"[^>]*>published<span class="gallery-sort-arrow"/);
  assert.match(out, /href="\/gallery\/\?sort=title&amp;order=asc"[^>]*>title<\/a>/);
});

test("the declared sort keys are the only ones offered; a collection without sort shows none", () => {
  const out = render(props("/gallery/"));
  assert.doesNotMatch(out, /data-gallery-sort="author"/);
  const plain = render(props("/gallery/", "en", { filters: ["status"], sort: [] }));
  assert.doesNotMatch(plain, /gallery-sort/);
  assert.match(plain, /gallery-facets/);
});

test("the address picks the sort and the count, and an unknown key falls back to the first", () => {
  const out = render(props("/gallery/?sort=title&order=desc"));
  assert.deepEqual(cards(out), ["/books/gamma/", "/books/beta/", "/books/alpha/"]);
  assert.match(out, /data-gallery-sort="title"[^>]*aria-current="true"/);
  const fallback = render(props("/gallery/?sort=author&order=desc"));
  assert.deepEqual(cards(fallback), ["/books/beta/", "/books/alpha/", "/books/gamma/"]);
  assert.match(fallback, /data-gallery-sort="published"[^>]*aria-current="true"/);
});

test("a chosen filter narrows the grid, the count and the facet link", () => {
  const out = render(props("/gallery/?filter.status=done"));
  assert.deepEqual(cards(out), ["/books/alpha/", "/books/gamma/"]);
  assert.match(out, /Showing 2 of 3/);
  assert.match(out, /data-gallery-value="done"[^>]*aria-current="true"/);
  assert.match(out, /class="gallery-empty" tabindex="-1" hidden/);
  assert.match(out, /status<\/legend>.*done \(2\)/s);
});

test("nothing matches: the empty note shows in English, Persian and Arabic", () => {
  const cases = [
    ["en", "No records match these filters."],
    ["fa", "هیچ رکوردی با این فیلترها مطابقت ندارد."],
    ["ar", "لا توجد سجلات تطابق عوامل التصفية هذه."],
  ] as const;
  for (const [lang, text] of cases) {
    const out = render(props("/gallery/?filter.status=missing", lang));
    assert.deepEqual(cards(out), [], `${lang} shows no cards`);
    assert.match(out, new RegExp(`<p class="gallery-empty" tabindex="-1">${text}</p>`), lang);
    assert.match(out, /class="gallery-count"/, lang);
  }
});

test("the gallery asks for its filter island only when it offers controls", () => {
  const withControls = props("/gallery/");
  render(withControls);
  assert.ok(
    (withControls.islands as unknown as { src?: string }[]).some((island) =>
      island.src?.endsWith("/components/gallery-filters/client.js"),
    ),
  );

  const without = props("/gallery/", "en", { filters: [], sort: [] });
  render(without);
  assert.equal((without.islands as unknown[]).length, 0);
});
