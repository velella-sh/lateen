import assert from "node:assert/strict";
import { test } from "node:test";
import type { ComponentProps, DataRecord, Page, Site } from "@velella/mizzen/contracts";
import { renderToString } from "preact-render-to-string";
import term from "../components/term/index.ts";

const record: DataRecord = {
  id: "network",
  fields: { term: "Network", definition: "Two or more computers that talk.", aliases: ["Net"] },
  position: { line: 1, column: 1 },
  fieldPositions: {},
} as unknown as DataRecord;

interface SiteOptions {
  readonly page?: unknown;
  readonly base?: string;
  readonly pages?: readonly Partial<Page>[];
}

function siteWith({ page, base = "", pages = [] }: SiteOptions = {}): Site {
  return {
    config: {
      lang: "en",
      base,
      theme: { options: { glossary: { collection: "glossary", ...(page === undefined ? {} : { page }) } } },
    },
    nav: {},
    data: {},
    pages,
    collections: { glossary: { name: "glossary", source: "glossary.yml", records: [record] } },
  } as unknown as Site;
}

function render(site: Site, lang = "en"): string {
  const page = { lang, url: "/guide/", frontMatter: {} } as unknown as Page;
  return renderToString(term({ props: {}, html: "Network", page, site } as unknown as ComponentProps));
}

test("a glossary page option links the term to its entry on that page", () => {
  const out = render(siteWith({ page: "/glossary/" }));
  assert.match(out, /<a class="term-link" href="\/glossary\/#network">Glossary<\/a>/);
});

test("the page option is a mapping per language, with the default language as fallback", () => {
  const page = { en: "/glossary/", fa: "/fa/glossary/", ar: "/ar/glossary/" };
  assert.match(render(siteWith({ page }), "fa"), /href="\/fa\/glossary\/#network"/);
  assert.match(render(siteWith({ page }), "ar"), /href="\/ar\/glossary\/#network"/);
  assert.match(render(siteWith({ page: { en: "/glossary/" } }), "fa"), /href="\/glossary\/#network"/);
});

test("the option's address keeps its own shape: no slash is invented", () => {
  assert.match(render(siteWith({ page: "/words" })), /href="\/words#network"/);
});

test("without a page option the term links to its record page", () => {
  const pages = [
    { url: "/", kind: "home" },
    { url: "/terms/network/", record: { collection: "glossary", id: "network" } },
    { url: "/books/a/", record: { collection: "books", id: "network" } },
  ] as unknown as readonly Page[];
  const out = render(siteWith({ pages }));
  assert.match(out, /<a class="term-link" href="\/terms\/network\/">Glossary<\/a>/);
});

test("a record page's URL already carries the site base and is not prefixed twice", () => {
  const pages = [{ url: "/docs/terms/network/", record: { collection: "glossary", id: "network" } }] as unknown as readonly Page[];
  const out = render(siteWith({ base: "/docs", pages }));
  assert.match(out, /href="\/docs\/terms\/network\/"/);
  assert.doesNotMatch(out, /\/docs\/docs\//);
});

test("the glossary page option gets the site base in front of a root-relative path", () => {
  const out = render(siteWith({ page: "/glossary/", base: "/docs" }));
  assert.match(out, /href="\/docs\/glossary\/#network"/);
});

test("an external glossary page address is left as written", () => {
  const out = render(siteWith({ page: "https://example.com/glossary/" }));
  assert.match(out, /href="https:\/\/example\.com\/glossary\/#network"/);
});

test("neither a page option nor a record page renders no link", () => {
  const out = render(siteWith());
  assert.match(out, /<details class="term" data-term="network">/);
  assert.match(out, /<p class="term-definition">Two or more computers that talk\.<\/p>/);
  assert.doesNotMatch(out, /<a\b|term-link/);
});

test("an option that is not an address is ignored instead of becoming a broken link", () => {
  assert.doesNotMatch(render(siteWith({ page: 42 })), /<a\b/);
  assert.doesNotMatch(render(siteWith({ page: " " })), /<a\b/);
  assert.doesNotMatch(render(siteWith({ page: { fa: "/fa/glossary/" } })), /<a\b/);
});
