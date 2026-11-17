import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToString } from "preact-render-to-string";
import type { LayoutProps, ListProps, Page, RecordProps, Site, SiteConfig, SourcePos } from "@velella/mizzen/contracts";
import gallery from "../layouts/gallery.ts";
import { build } from "./integration-helpers.ts";

const pos: SourcePos = { file: "gallery.md", line: 1, column: 1, endLine: 1, endColumn: 1 };

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
  collection: "books",
  id,
  url: `/books/${id}/`,
  fields,
  links: {},
});

function props(page: Partial<Page> = {}, list?: ListProps): LayoutProps {
  const full = {
    url: "/gallery/",
    source: pos,
    frontMatter: {},
    title: "Gallery",
    lang: "en",
    dir: "ltr",
    headings: [],
    html: "<p>Everything in the catalogue, one card each.</p>",
    markdown: "Everything in the catalogue, one card each.",
    kind: "doc",
    ...page,
  } as Page;
  const site: Site = { config, pages: [full], nav: {}, data: {}, collections: {} };
  return {
    site,
    page: full,
    trail: [],
    pager: {},
    head: { title: "Gallery · Example", meta: [], links: [], jsonLd: [] },
    islands: [],
    ...(list === undefined ? {} : { list }),
  } as unknown as LayoutProps;
}

const render = (subject: LayoutProps) => renderToString(gallery(subject) as never);

const list = (records: readonly RecordProps[]): ListProps => ({
  collection: "books",
  records,
  groups: [],
  pagination: { page: 1, total: 1 },
});

const cards = (out: string) => [...out.matchAll(/<a class="card" href="([^"]*)">/g)].map((match) => match[1]);

test("the layout renders a card grid inside the page frame, with the title and the intro", () => {
  const out = render(props({}, list([record("alpha", { title: "Alpha", summary: "First." }), record("beta", { title: "Beta" })])));
  assert.match(out, /<main[^>]*><article class="gallery" data-pagefind-body="true">/);
  assert.match(out, /<h1>Gallery<\/h1>/);
  assert.match(out, /<div class="gallery-intro"><p>Everything in the catalogue, one card each.<\/p><\/div>/);
  assert.match(out, /<div class="cards">/);
  assert.deepEqual(cards(out), ["/books/alpha/", "/books/beta/"]);
  assert.match(out, /<span class="card-title">Alpha<\/span><span class="card-description">First\.<\/span>/);
  assert.doesNotMatch(out, /<table/);
});

test("a body that carries the title gets no second heading", () => {
  const out = render(props({ headings: [{ depth: 1, text: "Gallery", id: "gallery", pos }] }, list([record("alpha", {})])));
  assert.doesNotMatch(out, /<h1>/);
});

test("records without card fields fall back to the list layout's card: the id in the title", () => {
  const out = render(props({}, list([record("gamma", { notes: "No title here." }), record("delta", {})])));
  assert.deepEqual(cards(out), ["/books/gamma/", "/books/delta/"]);
  assert.match(out, /<span class="card-title">gamma<\/span>/);
  assert.match(out, /<span class="card-title">delta<\/span>/);
});

test("a page without list data renders its title and body alone", () => {
  const out = render(props());
  assert.doesNotMatch(out, /class="cards"/);
  assert.match(out, /<div class="gallery-intro">/);
});

test("the grouped records keep the engine's sections and anchors", () => {
  const grouped = {
    ...(list([record("alpha", { title: "Alpha" })]) as ListProps),
    groups: [{ key: "A", count: 1, records: [record("alpha", { title: "Alpha" })] }],
  } as ListProps;
  const out = render(props({}, grouped));
  assert.match(out, /<section class="gallery-group"><h2 id="a">A<\/h2><div class="cards">/);
});

test("the data site builds a gallery page with a card per record", () => {
  const site = build("data-site", process.env, {
    "gallery.md": [
      "---",
      'title: "Catalogue gallery"',
      'description: "Every component as a card."',
      "layout: gallery",
      "list: { collection: components }",
      "---",
      "Every component in the catalogue, one card each.",
      "",
    ].join("\n"),
  });
  const html = site.html("/gallery/");
  assert.match(html, /<article class="gallery" data-pagefind-body="true">/);
  assert.match(html, /<h1>Catalogue gallery<\/h1>/);
  assert.match(html, /<div class="gallery-intro"><p[^>]*>Every component in the catalogue, one card each.<\/p><\/div>/);
  assert.match(html, /<div class="cards">/);
  assert.match(html, /<a class="card" href="\/components\/button\/">/);
  assert.equal((html.match(/<a class="card"/g) ?? []).length, 12, "one card per component record");
});
