// The shared fixture factories keep one typed shape for every chrome, layout and record test
// (#866): the factory fills the required fields and the test names only what it asserts on. These
// tests pin that contract, so a factory that silently drops a required field fails here first.
import assert from "node:assert/strict";
import { test } from "node:test";
import { pageWith } from "./helpers/page.ts";
import { dataRecord, pageRecord, recordProps } from "./helpers/record.ts";
import { siteConfig, siteOf } from "./helpers/site.ts";

test("siteConfig fills every required field and applies focused overrides", () => {
  const config = siteConfig();
  assert.equal(config.title, "Example");
  assert.equal(config.base, "");
  assert.equal(config.lang, "en");
  assert.equal(config.dir, "ltr");
  assert.deepEqual(config.languages, []);
  assert.deepEqual(config.theme, { options: {} });
  const named = siteConfig({ title: "Alpha", base: "/alpha", theme: { options: { glossary: { collection: "glossary" } } } });
  assert.equal(named.title, "Alpha");
  assert.equal(named.base, "/alpha");
  assert.deepEqual(named.search, { text: 300 }, "the fields a test does not name stay at their fixture value");
  assert.deepEqual(named.theme.options, { glossary: { collection: "glossary" } });
});

test("siteOf builds a Site around the pages and config a test names", () => {
  const page = pageWith({ url: "/books/a/", title: "A" });
  const site = siteOf({
    pages: [page],
    config: { title: "Library" },
    data: { shelf: ["fiction"] },
    collections: { books: { name: "books", source: "books.yml", records: [] } },
  });
  assert.equal(site.config.title, "Library");
  assert.deepEqual(site.pages, [page]);
  assert.deepEqual(site.data, { shelf: ["fiction"] });
  assert.equal(site.collections.books?.name, "books");
  assert.deepEqual(site.nav, {});
  const empty = siteOf();
  assert.deepEqual(empty.pages, []);
  assert.equal(empty.config.title, "Example");
});

test("pageWith fills every required field and replaces what a test asserts", () => {
  const page = pageWith();
  assert.equal(page.url, "/guide/");
  assert.equal(page.title, "Guide");
  assert.equal(page.lang, "en");
  assert.equal(page.dir, "ltr");
  assert.equal(page.kind, "doc");
  assert.deepEqual(page.frontMatter, {});
  assert.deepEqual(page.headings, []);
  assert.match(page.source.file, /\.md$/);
  const named = pageWith({ url: "/example/guide/install/", title: "Install", frontMatter: { title: "Install" } });
  assert.equal(named.url, "/example/guide/install/");
  assert.equal(named.title, "Install");
  assert.deepEqual(named.frontMatter, { title: "Install" });
  assert.equal(named.lang, "en", "unnamed fields stay at the fixture value");
});

test("dataRecord carries a real source position and overrides replace it", () => {
  const record = dataRecord();
  assert.equal(record.id, "book-1");
  assert.deepEqual(record.fields, {});
  assert.deepEqual(record.fieldPositions, {});
  assert.equal(typeof record.position.startLine, "number");
  assert.equal(typeof record.position.startColumn, "number");
  assert.equal(typeof record.position.endLine, "number");
  assert.equal(typeof record.position.endColumn, "number");
  const named = dataRecord({ id: "b", fields: { title: "Beta" } });
  assert.equal(named.id, "b");
  assert.deepEqual(named.fields, { title: "Beta" });
});

test("pageRecord and recordProps carry identity, template and URL fixtures", () => {
  const record = pageRecord({ id: "b", collection: "recipes" });
  assert.equal(record.template, "record.md");
  assert.equal(record.templateLine, 1);
  assert.deepEqual(record.fallbacks, []);
  assert.equal(typeof record.position.startLine, "number");
  const props = recordProps({ id: "b", url: "/recipes/b/", fields: { title: "B" } });
  assert.equal(props.collection, "books");
  assert.deepEqual(props.links, {});
  assert.deepEqual(props.fields, { title: "B" });
});
