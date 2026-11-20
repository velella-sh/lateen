import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToString } from "preact-render-to-string";
import type { Heading, LayoutProps, Page, Site, SiteConfig, SourcePos } from "@velella/mizzen/contracts";
import record from "../layouts/record.ts";
import doc from "../layouts/doc.ts";

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

const heading = (depth: 1 | 2, text: string): Heading => ({ depth, text, id: text.toLowerCase(), pos });

function pageWith(overrides: Partial<Page> = {}): Page {
  return {
    url: "/components/button/",
    source: pos,
    frontMatter: {},
    title: "Button",
    lang: "en",
    dir: "ltr",
    headings: [],
    html: "<p>A control that starts an action.</p>",
    markdown: "A control that starts an action.",
    kind: "doc",
    ...overrides,
  } as Page;
}

function props(page: Page, withRecord = true): LayoutProps {
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
    ...(withRecord
      ? { record: { collection: "components", id: "button", url: page.url, fields: { name: "Button" }, links: {} } }
      : {}),
  } as unknown as LayoutProps;
}

const render = (page: Page, withRecord = true) => renderToString(record(props(page, withRecord)) as never);
const renderDoc = (page: Page) => renderToString(doc(props(page, false)) as never);

const landmarks = (html: string) =>
  [...html.matchAll(/<(header|main|nav|aside|footer)\b[^>]*>/g)]
    .map((match) => match[0])
    // The doc layout adds the previous/next pager; the record layout does not, per its issue.
    .filter((tag) => !tag.includes('class="pager"'))
    .sort();

test("a record page renders the record landmark inside the base shell", () => {
  const out = render(pageWith());
  assert.match(out, /<main id="main" tabindex="-1"><article class="record" data-pagefind-body="true">/);
  assert.match(out, /<div class="record-body"><p>A control that starts an action.<\/p><\/div>/);
});

test("the layout keeps the header, the sidebar, the drawer and the breadcrumb of the doc layout", () => {
  const page = pageWith();
  const recordOut = render(page);
  assert.deepEqual(landmarks(recordOut), landmarks(renderDoc(page)));
  assert.match(recordOut, /<nav class="breadcrumb"/);
  assert.match(recordOut, /<header class="site-header"/);
});

test("the title comes from the page, and the body's own h1 is not repeated", () => {
  const withoutBodyTitle = render(pageWith());
  assert.match(withoutBodyTitle, /<article class="record"[^>]*>[\s\S]*?<h1>Button<\/h1>[\s\S]*?<div class="record-body">/);

  const withBodyTitle = render(pageWith({ headings: [heading(1, "Button"), heading(2, "States")] }));
  assert.equal((withBodyTitle.match(/<h1>/g) ?? []).length, 0);
});

test("a page without record data renders the doc article instead", () => {
  const page = pageWith({ url: "/guide/install/" });
  assert.equal(render(page, false), renderDoc(page));
  assert.match(render(page, false), /<article class="doc"/);
});

test("the record page keeps the page footer under its actions", () => {
  const out = render(pageWith());
  assert.match(out, /<div class="doc-actions"><div class="page-footer">/);
});

test("a record with changed fields asks the engine for the history filter island", () => {
  const input = props(pageWith());
  (input.record as unknown as { changes: unknown[] }).changes = [
    { id: "1".repeat(16), type: "changed", record: "components", date: "2026-05-01", field: "name", old: "A", new: "B" },
  ];
  renderToString(record(input) as never);
  assert.ok(
    input.islands.some((island) => island.src.endsWith("components/record-history/client.js")),
    "the history filter runs without a Markdown directive",
  );
});
