import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { h } from "preact";
import { renderToString } from "preact-render-to-string";
import type {
  ChromeProps,
  DataRecord,
  LayoutProps,
  Page,
  PageRecord,
  RecordPos,
  Site,
  SiteConfig,
} from "@velella/mizzen/contracts";
import record from "../layouts/record.ts";
import sourceMode from "../chrome/source-mode/index.ts";
import { stamp, type SourceBlock, type SourceLabel } from "../chrome/source-mode/client.ts";
import { stringsOf } from "../i18n/index.ts";

const dataFile = "data/books.yml";
const templateFile = "templates/book.md";

const at = (startLine: number, startColumn: number, endLine: number, endColumn: number): RecordPos => ({
  file: dataFile,
  startLine,
  startColumn,
  endLine,
  endColumn,
});

const data: DataRecord = {
  id: "dune",
  fields: { title: "Dune", summary: "A **book**.", isbn: "978" },
  position: at(12, 3, 20, 9),
  fieldPositions: { title: at(13, 10, 13, 14), summary: at(14, 10, 16, 1) },
};

const pageRecord: PageRecord = {
  collection: "books",
  id: "dune",
  position: at(12, 3, 20, 9),
  template: templateFile,
  templateLine: 6,
  fallbacks: [],
};

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

const site: Site = {
  config,
  pages: [],
  nav: { main: [] },
  data: {},
  collections: { books: { name: "books", source: dataFile, records: [data] } },
};

const page: Page = {
  url: "/books/dune/",
  source: { file: templateFile, line: 6, column: 1, endLine: 6, endColumn: 1 },
  frontMatter: {
    record: {
      facts: [
        { field: "title", label: "Title" },
        { field: "isbn", label: "ISBN" },
      ],
    },
  },
  title: "Dune",
  lang: "en",
  dir: "ltr",
  headings: [],
  html:
    `<h1 data-src="${templateFile}:6:1-6:14">Dune</h1>\n` +
    `<p data-src="${dataFile}:14:10-16:1">A <strong>book</strong>.</p>`,
  markdown: "A book.",
  kind: "doc",
  record: pageRecord,
};

function props(lang = "en"): LayoutProps {
  return {
    site,
    page: { ...page, lang, dir: lang === "en" ? "ltr" : "rtl" },
    trail: [],
    pager: {},
    head: { title: "Dune", meta: [], links: [], jsonLd: [] },
    islands: [],
    record: { collection: "books", id: "dune", url: page.url, fields: data.fields, links: {} },
  } as unknown as LayoutProps;
}

const render = (lang = "en"): string => renderToString(record(props(lang)) as never);

function switchOf(lang: string): string {
  const switchPage = { lang, dir: lang === "en" ? "ltr" : "rtl", record: pageRecord } as unknown as Page;
  const chrome = { site: { config: { theme: {} } }, page: switchPage } as unknown as ChromeProps;
  return renderToString(h("div", null, sourceMode(chrome) as never));
}

function labelsOf(lang = "en") {
  const dom = new JSDOM(`<!doctype html><html lang="${lang}"><body>${render(lang)}${switchOf(lang)}</body></html>`);
  const document = dom.window.document;
  const root = document.querySelector("[data-source-mode]");
  const messages = (name: string): string => root?.getAttribute(`data-msg-${name}`) ?? "";
  const kindOf = (file: string): string | undefined =>
    file === root?.getAttribute("data-record-template")
      ? messages("kind-template")
      : file === root?.getAttribute("data-record-data")
        ? messages("kind-data")
        : undefined;
  stamp({
    blocks: [...document.querySelectorAll("[data-src]")] as unknown as SourceBlock[],
    createLabel: () => document.createElement("span") as unknown as SourceLabel,
    actions: {
      storage: undefined,
      messages,
      kindOf,
      createElement: (tag) => document.createElement(tag) as unknown as SourceLabel,
      copy: async () => true,
      announce: () => {},
    },
  });
  return { document, root };
}

test("a fact carries the data file position the engine gives for its field", () => {
  const out = render();
  assert.match(
    out,
    /<dd class="key-value-value record-fact" data-src="data\/books\.yml:13:10-13:14">Dune<\/dd>/,
  );
  assert.match(out, /<dd class="key-value-value record-fact">978<\/dd>/, "a fact without a field position gets none");
  assert.doesNotMatch(out, /record-fact[^>]*data-src="data\/books\.yml:12:/, "the record start is not a field position");
});

test("a fact, a template block, and a Markdown field are labelled and told apart by a word", () => {
  const { document, root } = labelsOf();
  assert.equal(root?.getAttribute("data-record-template"), templateFile);
  assert.equal(root?.getAttribute("data-record-data"), dataFile);

  const fact = document.querySelector("dd[data-src]");
  const template = document.querySelector("article h1[data-src]");
  const markdown = document.querySelector("article p[data-src]");
  assert.ok(fact && template && markdown);

  assert.equal(fact.querySelector(".source-label-kind")?.textContent, "Data");
  assert.equal(fact.querySelector(".source-label-copy")?.textContent, "data/books.yml:13");

  assert.equal(template.querySelector(".source-label-kind")?.textContent, "Template");
  assert.equal(template.querySelector(".source-label-copy")?.textContent, "templates/book.md:6");

  assert.equal(markdown.querySelector(".source-label-kind")?.textContent, "Data");
  assert.equal(markdown.querySelector(".source-label-copy")?.textContent, "data/books.yml:14");
});

test("the kind words are text in every page language", () => {
  for (const lang of ["en", "fa", "ar"] as const) {
    const { root } = labelsOf(lang);
    assert.equal(root?.getAttribute("data-msg-kind-data"), stringsOf(lang).source_kind_data);
    assert.equal(root?.getAttribute("data-msg-kind-template"), stringsOf(lang).source_kind_template);
  }
  assert.notEqual(stringsOf("fa").source_kind_data, stringsOf("en").source_kind_data);
  assert.notEqual(stringsOf("ar").source_kind_data, stringsOf("en").source_kind_data);
  assert.notEqual(stringsOf("fa").source_kind_template, stringsOf("en").source_kind_template);
});
