import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToString } from "preact-render-to-string";
import type { ComponentProps, LayoutProps, Page, Site, SiteConfig, SourcePos } from "@velella/mizzen/contracts";
import record from "../layouts/record.ts";
import recordTable from "../components/record-table/index.ts";

const pos: SourcePos = { file: "components/button.md", line: 1, column: 1, endLine: 1, endColumn: 1 };

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

const fields = {
  name: "Button",
  package: "@scope/pkg",
  slug: "@scope/pkg/guide",
  pages: 3,
  zero: 0,
  half: 0.5,
  blank: "  ",
  na: null,
  published: "2026-11-09",
  draft: false,
};

const facts = JSON.stringify([
  { field: "name", label: "Name" },
  { field: "pages", label: "Pages", kind: "number" },
  { field: "published", label: "Published", kind: "date" },
  { field: "draft", label: "Draft", kind: "boolean" },
]);

function pageWith(factList: unknown = JSON.parse(facts)): Page {
  return {
    url: "/components/button/",
    source: pos,
    frontMatter: { record: { facts: factList } },
    title: "Button",
    lang: "en",
    dir: "ltr",
    headings: [],
    html: "<p>A control that starts an action.</p>",
    markdown: "A control that starts an action.",
    kind: "doc",
  } as unknown as Page;
}

function props(page: Page, id = "button"): LayoutProps {
  const site: Site = {
    config,
    pages: [page],
    nav: { main: [{ title: "Components", url: "/components/" }] },
    data: {},
    collections: {},
  };
  return {
    site,
    page,
    trail: [{ title: "Components", url: "/components/" }, { title: page.title, url: page.url }],
    pager: { prev: { title: "Badge", url: "/components/badge/" }, next: { title: "Callout", url: "/components/callout/" } },
    head: { title: `${page.title} · Example`, meta: [], links: [], jsonLd: [] },
    islands: [],
    record: { collection: "components", id, url: page.url, fields, links: {} },
  } as unknown as LayoutProps;
}

const render = (page: Page = pageWith(), id = "button") => renderToString(record(props(page, id)) as never);

/** One record of the `books` collection as a table, so facts and cells read the same values. */
function renderTable(columns: unknown[], lang = "en"): string {
  const site = {
    config,
    nav: { main: [] },
    data: {},
    pages: [],
    collections: {
      books: { name: "books", source: "books.yml", records: [{ id: "a", fields, position: pos, fieldPositions: {} }] },
    },
  } as unknown as Site;
  return renderToString(
    recordTable({
      props: { from: "books", columns: JSON.stringify(columns) },
      page: { lang, url: "/books/", frontMatter: {} } as unknown as Page,
      site,
      html: "",
    } as unknown as ComponentProps) as never,
  );
}

test("the facts render in the author's order, after the title and before the body", () => {
  const out = render();
  const name = out.indexOf(">Name</dt>");
  const pages = out.indexOf(">Pages</dt>");
  const published = out.indexOf(">Published</dt>");
  const draft = out.indexOf(">Draft</dt>");
  assert.ok(name > out.indexOf("<h1>Button</h1>"), "the panel follows the title");
  assert.ok(name < pages && pages < published && published < draft, "the author's order is kept");
  assert.ok(draft < out.indexOf('class="record-body"'), "the panel comes before the body");
  assert.match(out, /<dl class="key-value"/);
});

test("facts with a group gather under its label in the configured order", () => {
  const out = render(
    pageWith([
      { field: "name", label: "Name", group: "About" },
      { field: "pages", label: "Pages", kind: "number", group: "Specs" },
      { field: "published", label: "Published", kind: "date", group: "About" },
    ]),
  );
  assert.match(
    out,
    /<div class="record-fact-group" role="group" aria-labelledby="record-fact-group-1"><p class="record-fact-group-label" id="record-fact-group-1">About<\/p><dt class="key-value-key">Name<\/dt>/,
  );
  const about = out.indexOf(">About</p>");
  const specs = out.indexOf(">Specs</p>");
  const name = out.indexOf(">Name</dt>");
  const pages = out.indexOf(">Pages</dt>");
  const published = out.indexOf(">Published</dt>");
  assert.ok(about < name && name < published, "the group keeps the author's fact order");
  assert.ok(published < specs && specs < pages, "a later group follows the first one, in first-appearance order");
  assert.match(out, /Specs<\/p><dt class="key-value-key">Pages<\/dt>/);
});

test("a fact without a group keeps the flat panel", () => {
  const out = render();
  assert.ok(!out.includes("record-fact-group"), "no group wrapper without configured groups");
  assert.match(out, /<dl class="key-value" id="record-facts"><dt class="key-value-key">Name<\/dt>/);
});

test("a group whose facts are all missing is left out", () => {
  const out = render(
    pageWith([
      { field: "name", label: "Name", group: "About" },
      { field: "editor", label: "Editor", group: "Gone" },
    ]),
  );
  assert.match(out, />About<\/p>/);
  assert.ok(!out.includes("Gone"), "a group with no rendered fact has no label");
  assert.equal(out.match(/record-fact-group-label/g)?.length, 1);
});

test("every kind goes through the field formatter", () => {
  const out = render();
  assert.match(out, /<dt class="key-value-key">Name<\/dt><dd class="key-value-value record-fact" data-kind="text">Button<\/dd>/);
  assert.match(out, /<dt class="key-value-key">Pages<\/dt><dd class="key-value-value record-fact" data-kind="number">3<\/dd>/);
  assert.match(out, /<dd class="key-value-value record-fact" data-kind="date"><time datetime="2026-11-09">[^<]+<\/time><\/dd>/);
  assert.match(out, /<dt class="key-value-key">Draft<\/dt><dd class="key-value-value record-fact" data-kind="boolean">No<\/dd>/);
});

test("a fact the record lacks is left out, not rendered empty", () => {
  const page = pageWith([
    { field: "name", label: "Name" },
    { field: "editor", label: "Editor" },
  ]);
  const out = render(page);
  assert.match(out, />Name<\/dt>/);
  assert.ok(!out.includes(">Editor</dt>"), "no row for a missing field");
});

test("the id is a fact a page may ask for", () => {
  const out = render(pageWith([{ field: "id", label: "Identifier" }]));
  assert.match(out, /<dt class="key-value-key">Identifier<\/dt><dd class="key-value-value record-fact" data-kind="text"><bdi dir="ltr">button<\/bdi><\/dd>/);
});

test("package names, slugs, and ids stay left to right on a right-to-left page", () => {
  const factList = [
    { field: "package", label: "Package" },
    { field: "slug", label: "Slug" },
    { field: "id", label: "Identifier" },
  ];
  const page = { ...pageWith(factList), lang: "fa", dir: "rtl" } as Page;
  const out = render(page, "@scope/pkg/guide");
  assert.match(out, /<dt class="key-value-key">Package<\/dt><dd[^>]*><bdi dir="ltr">@scope\/pkg<\/bdi><\/dd>/);
  assert.match(out, /<dt class="key-value-key">Slug<\/dt><dd[^>]*><bdi dir="ltr">@scope\/pkg\/guide<\/bdi><\/dd>/);
  assert.match(out, /<dt class="key-value-key">Identifier<\/dt><dd[^>]*><bdi dir="ltr">@scope\/pkg\/guide<\/bdi><\/dd>/);
  assert.doesNotMatch(out, /<bdi[^>]*>Package<\/bdi>/);
});

test("a page without facts renders no panel", () => {
  const none = pageWith([]);
  assert.ok(!render(none).includes('class="key-value"'));
  const missing = pageWith([{ field: "editor", label: "Editor" }]);
  assert.ok(!render(missing).includes('class="key-value"'), "no panel when every fact is missing");
});

test("zero and decimal numbers keep their value, digits, and data kind on facts and table cells", () => {
  const factList = [
    { field: "zero", label: "Zero", kind: "number" },
    { field: "half", label: "Half", kind: "number" },
  ];
  const en = render(pageWith(factList));
  assert.match(en, /<dd class="key-value-value record-fact" data-kind="number">0<\/dd>/);
  assert.match(en, /<dd class="key-value-value record-fact" data-kind="number">0\.5<\/dd>/);

  const faPage = { ...pageWith(factList), lang: "fa" } as Page;
  const fa = render(faPage);
  assert.match(fa, /<dd class="key-value-value record-fact" data-kind="number">۰<\/dd>/);
  assert.match(fa, /<dd class="key-value-value record-fact" data-kind="number">۰٫۵<\/dd>/);

  const columns = [
    { field: "title", label: "Title" },
    { field: "zero", label: "Zero", kind: "number" },
    { field: "half", label: "Half", kind: "number" },
  ];
  assert.match(renderTable(columns, "en"), /data-kind="number"[^>]*data-value="0">0<\/td>/);
  assert.match(renderTable(columns, "en"), /data-kind="number"[^>]*data-value="0\.5">0\.5<\/td>/);
  assert.match(renderTable(columns, "fa"), /data-kind="number"[^>]*data-value="0">۰<\/td>/);
  assert.match(renderTable(columns, "fa"), /data-kind="number"[^>]*data-value="0\.5">۰٫۵<\/td>/);
});

test("missing, not applicable, and zero read distinctly in facts and table cells", () => {
  const factList = [
    { field: "blank", label: "Blank" },
    { field: "na", label: "Not applicable" },
    { field: "zero", label: "Zero", kind: "number" },
  ];

  const facts = render(pageWith(factList));
  assert.match(facts, /data-kind="text" data-state="missing"><span class="field-empty" data-state="missing">No value<\/span>/);
  assert.match(
    facts,
    /data-kind="text" data-state="not-applicable"><span class="field-na" data-state="not-applicable">Not applicable<\/span>/,
  );
  assert.match(facts, /data-kind="number">0<\/dd>/);

  const faFacts = render({ ...pageWith(factList), lang: "fa" } as Page);
  assert.match(faFacts, /data-state="missing"><span class="field-empty" data-state="missing">بدون مقدار<\/span>/);
  assert.match(faFacts, /data-state="not-applicable"><span class="field-na" data-state="not-applicable">ناموجود<\/span>/);
  assert.match(faFacts, /data-kind="number">۰<\/dd>/);

  const columns = [
    { field: "title", label: "Title" },
    { field: "blank", label: "Blank" },
    { field: "na", label: "Not applicable" },
    { field: "zero", label: "Zero", kind: "number" },
  ];
  const table = renderTable(columns);
  assert.match(table, /data-kind="text" data-state="missing"><span class="field-empty" data-state="missing">No value<\/span>/);
  assert.match(
    table,
    /data-kind="text" data-state="not-applicable"><span class="field-na" data-state="not-applicable">Not applicable<\/span>/,
  );
  assert.match(table, /data-kind="number" data-value="0">0<\/td>/);

  const faTable = renderTable(columns, "fa");
  assert.match(faTable, /data-state="missing"><span class="field-empty" data-state="missing">بدون مقدار<\/span>/);
  assert.match(faTable, /data-state="not-applicable"><span class="field-na" data-state="not-applicable">ناموجود<\/span>/);
  assert.match(faTable, /data-kind="number" data-value="0">۰<\/td>/);
  assert.match(faTable, /data-state="not-applicable"[^>]*><span class="field-na"[^>]*>ناموجود<\/span><\/td>/);
});
