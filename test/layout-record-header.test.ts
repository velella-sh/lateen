import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToString } from "preact-render-to-string";
import type { LayoutProps, Page, Site, SiteConfig, SourcePos } from "@velella/mizzen/contracts";
import record from "../layouts/record.ts";

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
  theme: {
    options: {
      status: {
        values: {
          done: { tone: "positive", label: { en: "Done", fa: "انجام شد" } },
          new: { tone: "info" },
        },
      },
    },
  },
  search: { text: 300 },
  redirects: {},
  outputs: {},
  collections: {},
  feeds: {},
} as unknown as SiteConfig;

const fields = { title: "Button", description: "A control that starts an action.", state: "done" };

const front = { record: { summary: "description", status: "state" } };

function pageWith(options: { front?: unknown; headings?: { depth: number; text: string; id: string }[]; html?: string } = {}): Page {
  return {
    url: "/components/button/",
    source: pos,
    frontMatter: options.front ?? front,
    title: "Button",
    lang: "en",
    dir: "ltr",
    headings: options.headings ?? [],
    html: options.html ?? "<p>A control that starts an action.</p>",
    markdown: "",
    kind: "doc",
  } as unknown as Page;
}

function props(page: Page, recordFields = fields): LayoutProps {
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
    record: { collection: "components", id: "button", url: page.url, fields: recordFields, links: {} },
  } as unknown as LayoutProps;
}

const render = (page: Page = pageWith(), recordFields = fields) => renderToString(record(props(page, recordFields)) as never);

test("the summary is the lead paragraph and the status sits beside the title", () => {
  const out = render();
  const header = out.indexOf('class="record-header"');
  const heading = out.indexOf("<h1>Button</h1>");
  const chip = out.indexOf('class="status status-positive"');
  const summary = out.indexOf('<p class="record-summary">A control that starts an action.</p>');
  assert.ok(header !== -1 && heading > header, "the title is in the header row");
  assert.ok(chip > heading, "the status follows the title in the same row");
  assert.ok(summary > chip, "the summary comes after the header");
  assert.ok(summary < out.indexOf('class="record-body"'), "and before the body");
  assert.match(out, /<span class="status-label">Done<\/span>/);
});

test("the status label follows the page language", () => {
  const page = { ...pageWith(), lang: "fa", dir: "rtl" } as Page;
  assert.match(render(page), /<span class="status-label">انجام شد<\/span>/);
});

test("a status the map does not know shows the value, neutral", () => {
  const out = render(pageWith(), { ...fields, state: "archived" });
  assert.match(out, /class="status status-neutral"/);
  assert.match(out, /<span class="status-label">archived<\/span>/);
});

test("a missing summary field renders no lead paragraph", () => {
  const out = render(pageWith(), { title: "Button", state: "done" });
  assert.ok(!out.includes("record-summary"), "no empty lead");
  assert.match(out, /class="record-header"/);
});

test("a missing status field renders the title alone", () => {
  const out = render(pageWith(), { title: "Button", description: "Lead." });
  assert.ok(!out.includes("record-status"));
  assert.ok(!out.includes("status status-"), "no chip without a value");
  assert.match(out, /<h1>Button<\/h1>/);
  assert.match(out, /<p class="record-summary">Lead\.<\/p>/);
});

test("a page that names neither field renders the title and body alone", () => {
  const out = render(pageWith({ front: { record: { facts: [] } } }));
  assert.ok(!out.includes("record-status"));
  assert.ok(!out.includes("record-summary"));
  assert.match(out, /class="record-header"><h1>Button<\/h1><\/div>/);
});

test("a title in the body keeps one h1, and the header still carries the status", () => {
  const page = pageWith({
    headings: [{ depth: 1, text: "Button", id: "button" }],
    html: "<h1 id=\"button\">Button</h1><p>A control that starts an action.</p>",
  });
  const out = render(page);
  assert.equal(out.match(/<h1/g)?.length, 1, "the template's title is not repeated");
  assert.match(out, /class="record-header"><span class="record-status">/);
});

test("the body keeps the heading outline: the summary is not a heading", () => {
  const page = pageWith({
    headings: [
      { depth: 1, text: "Button", id: "button" },
      { depth: 2, text: "Usage", id: "usage" },
    ],
    html: "<h1 id=\"button\">Button</h1><h2 id=\"usage\">Usage</h2>",
  });
  const out = render(page);
  const article = out.slice(out.indexOf("<article"), out.indexOf("</article>"));
  const outline = [...article.matchAll(/<h([1-6])/g)].map((match) => Number(match[1]));
  assert.deepEqual(outline, [1, 2], "the article holds one h1 then the body's h2");
});
