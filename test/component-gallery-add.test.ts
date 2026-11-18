// The gallery's own card comes from `theme.options.gallery.addCard`, keeps the record cards' shape,
// closes the grid (or its last group), and is absent when the option or its link is unusable.
import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToString } from "preact-render-to-string";
import type { LayoutProps, ListProps, Page, RecordProps, Site, SiteConfig, SourcePos } from "@velella/mizzen/contracts";
import gallery from "../layouts/gallery.ts";
import { ADD_CLASS, addCardOf } from "../components/gallery-card/add-card.ts";

const pos: SourcePos = { file: "gallery.md", line: 1, column: 1, endLine: 1, endColumn: 1 };

function config(options: Readonly<Record<string, unknown>> = {}, base = ""): SiteConfig {
  return {
    title: "Example",
    base,
    lang: "en",
    dir: "ltr",
    languages: [],
    source: ".",
    include: [],
    exclude: [],
    navigation: "_data/navigation.yml",
    defaults: [],
    theme: { options },
    search: { text: 300 },
    redirects: {},
    outputs: {},
    collections: {},
    feeds: {},
  } as unknown as SiteConfig;
}

const record = (id: string): RecordProps => ({
  collection: "books",
  id,
  url: `/books/${id}/`,
  fields: { title: id },
  links: {},
});

const page = {
  url: "/gallery/",
  source: pos,
  frontMatter: {},
  title: "Gallery",
  lang: "en",
  dir: "ltr",
  headings: [],
  html: "",
  markdown: "",
  kind: "doc",
} as Page;

function props(site: Site, list?: ListProps): LayoutProps {
  return {
    site,
    page,
    trail: [],
    pager: {},
    head: { title: "Gallery · Example", meta: [], links: [], jsonLd: [] },
    islands: [],
    ...(list === undefined ? {} : { list }),
  } as unknown as LayoutProps;
}

const list = (records: readonly RecordProps[], groups: ListProps["groups"] = []): ListProps => ({
  collection: "books",
  records,
  groups,
  pagination: { page: 1, total: 1 },
});

const siteWith = (options: Readonly<Record<string, unknown>>, base = ""): Site =>
  ({ config: config(options, base), pages: [page], nav: {}, data: {}, collections: {} }) as unknown as Site;

const render = (site: Site, records: readonly RecordProps[]): string =>
  renderToString(gallery(props(site, list(records))) as never);

const add = (label: unknown, link: unknown) => ({ gallery: { addCard: { label, link } } });

test("the option renders a card in the record cards' shape, with the site's base", () => {
  const html = renderToString(addCardOf(config(add("Add yours", "/gallery/new/"), "/example")) as never);
  assert.match(html, /<a class="card gallery-card-add" href="\/example\/gallery\/new\/">/);
  assert.match(html, /<span class="card-title">Add yours<\/span>/);
});

test("an https link is kept as written", () => {
  const html = renderToString(addCardOf(config(add("Add yours", "https://example.com/new"))) as never);
  assert.match(html, /href="https:\/\/example\.com\/new"/);
});

test("a missing or incomplete option renders no card", () => {
  assert.equal(addCardOf(config()), undefined);
  assert.equal(addCardOf(config({ gallery: {} })), undefined);
  assert.equal(addCardOf(config(add("", "/gallery/new/"))), undefined);
  assert.equal(addCardOf(config(add("Add yours", "javascript:alert(1)"))), undefined);
  assert.equal(addCardOf(config(add("Add yours", "gallery/new"))), undefined);
});

test("the card closes the grid in a filtered view", () => {
  const site = siteWith(add("Add yours", "/gallery/new/"));
  const out = render(site, [record("alpha")]);

  const grid = out.slice(out.indexOf('<div class="cards">'), out.indexOf("</div></div></article>"));
  assert.match(grid, new RegExp(`<a class="card gallery-card-add" href="/gallery/new/">`));
  assert.ok(
    grid.lastIndexOf("gallery-card-add") > grid.lastIndexOf("/books/alpha/"),
    "the site's card comes after the records",
  );
});

test("a site without the option keeps exactly the record cards", () => {
  const out = render(siteWith({}), [record("alpha")]);
  assert.doesNotMatch(out, new RegExp(ADD_CLASS));
});

test("a grouped gallery puts the card only at the end of its last group", () => {
  const site = siteWith(add("Add yours", "/gallery/new/"));
  const grouped = list([], [
    { key: "A", count: 1, records: [record("alpha")] },
    { key: "B", count: 1, records: [record("beta")] },
  ]);
  const out = renderToString(gallery(props(site, grouped)) as never);
  const sections = out.split('<section class="gallery-group">').slice(1);

  assert.doesNotMatch(sections[0]!, new RegExp(ADD_CLASS));
  assert.match(sections[1]!, new RegExp(ADD_CLASS));
  assert.ok(sections[1]!.lastIndexOf(ADD_CLASS) > sections[1]!.lastIndexOf("/books/beta/"));
});
