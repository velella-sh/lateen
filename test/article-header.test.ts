import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { renderToString } from "preact-render-to-string";
import type { Heading, LayoutProps, Page, Site, SiteConfig, SourcePos } from "@velella/mizzen/contracts";
import doc from "../layouts/doc.ts";
import guide from "../layouts/guide.ts";
import tutorial from "../layouts/tutorial.ts";

const pos: SourcePos = { file: "guide/install.md", line: 1, column: 1, endLine: 1, endColumn: 1 };

const config: SiteConfig = {
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
};

function heading(depth: 1 | 2 | 3, text: string): Heading {
  return { depth, text, id: text.toLowerCase(), pos };
}

function pageWith(overrides: Partial<Page> = {}): Page {
  return {
    url: "/guide/install/",
    source: pos,
    frontMatter: {},
    title: "Install",
    lang: "en",
    dir: "ltr",
    headings: [],
    html: "<p>Run the build.</p>",
    markdown: "Run the build.",
    kind: "doc",
    ...overrides,
  };
}

function propsOf(page: Page, data: Site["data"] = {}): LayoutProps {
  const site: Site = { config, pages: [page], nav: { main: [] }, data, collections: {} };
  return {
    site,
    page,
    trail: [],
    pager: {},
    head: { title: page.title, meta: [], links: [], jsonLd: [] },
    islands: [],
  };
}

const render = (layout: typeof doc, page: Page, data: Site["data"] = {}): string =>
  renderToString(layout(propsOf(page, data)) as never);

const LONG_TITLE =
  "Reading a page header when the title is long enough to wrap across several lines and still keep its hierarchy";

const css = readFileSync(new URL("../styles/generated.css", import.meta.url), "utf8");

/** The declarations of the first rule whose selector is `selector`, alone or first in a list. */
function bodyOf(selector: string): string {
  const base = selector.endsWith(",") ? selector.slice(0, -1) : selector;
  const escaped = base
    .split(/\s*>\s*/)
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("\\s*>\\s*");
  const exact = new RegExp(`${escaped}\\{([^}]*)\\}`).exec(css);
  if (exact !== null) return exact[1] ?? "";
  const listed = new RegExp(`${escaped},[^{}]*\\{([^}]*)\\}`).exec(css);
  return listed?.[1] ?? "";
}

test("a long title stays one intact heading, with the description and facts after it", () => {
  const page = pageWith({
    title: LONG_TITLE,
    frontMatter: { description: "A description that explains the page in one sentence." },
  });
  const html = render(doc, page);

  assert.equal(html.match(/<h1\b/g)?.length, 1);
  assert.ok(html.includes(`<h1>${LONG_TITLE}</h1>`), "the whole title is present, never truncated");
  assert.ok(html.indexOf("<h1>") < html.indexOf("doc-description"));
  assert.ok(html.indexOf("doc-description") < html.indexOf('class="doc-meta"'));
  assert.doesNotMatch(html, /text-overflow|ellipsis/);
});

test("a missing or blank description leaves no empty paragraph", () => {
  for (const page of [pageWith(), pageWith({ frontMatter: { description: "  \n" } })]) {
    const html = render(doc, page);
    assert.doesNotMatch(html, /doc-description/);
    assert.match(html, /<h1>Install<\/h1>/);
  }
});

test("a page with no description still places its facts directly under the title", () => {
  const page = pageWith({ frontMatter: { last_modified_at: "2026-03-04" } });
  const data = { "reading-time": [{ url: page.url, words: 400, minutes: 2 }] };
  const html = render(doc, page, data);
  assert.match(html, /<h1>Install<\/h1><div class="doc-meta"><p class="last-updated">[\s\S]*?<p class="reading-time"/);
});

test("several secondary facts share one compact metadata row in data order", () => {
  const page = pageWith({ frontMatter: { last_modified_at: "2026-03-04" } });
  const data = {
    trust: { [page.url]: { level: "verified", reasons: ["All examples passed."] } },
    "reading-time": [{ url: page.url, words: 400, minutes: 2 }],
  };
  const html = render(doc, page, data);
  const start = html.indexOf('<div class="doc-meta">');
  const end = html.indexOf('<div class="doc-body"');
  const meta = start === -1 || end === -1 ? "" : html.slice(start, end);
  assert.ok(meta.includes('class="trust-panel trust-panel-verified"'), "review state");
  assert.ok(meta.includes('class="last-updated"'), "date");
  assert.ok(meta.includes('class="reading-time"'), "reading time");
  assert.ok(meta.indexOf("trust-panel") < meta.indexOf("last-updated"));
  assert.ok(meta.indexOf("last-updated") < meta.indexOf("reading-time"));
  assert.equal(html.match(/class="doc-meta"/g)?.length, 1);
});

test("quickstart keeps the title and description but leaves the metadata out", () => {
  const page = pageWith({
    frontMatter: { quickstart: true, description: "Install it first." },
  });
  const data = { "reading-time": [{ url: page.url, words: 400, minutes: 2 }] };
  const html = render(doc, page, data);
  assert.match(html, /<h1>Install<\/h1><p class="doc-description dek">Install it first\.<\/p>/);
  assert.doesNotMatch(html, /class="doc-meta"/);
  assert.match(html, /data-quickstart/);
});

test("the guide puts the date and reading time in the shared row above its summary", () => {
  const page = pageWith({
    frontMatter: { last_modified_at: "2026-03-04", guide: { from: "v1", to: "v2", time: "10 min" } },
  });
  const data = { "reading-time": [{ url: page.url, words: 400, minutes: 2 }] };
  const html = render(guide, page, data);
  assert.match(html, /<h1>Install<\/h1><div class="doc-meta"><p class="last-updated">[\s\S]*?<p class="reading-time"/);
  assert.ok(html.indexOf('class="doc-meta"') < html.indexOf('class="guide-summary"'));
  assert.ok(html.indexOf('class="guide-summary"') < html.indexOf('class="doc-body guide-body"'));
});

test("the tutorial puts the date and reading time in the shared row above the steps", () => {
  const page = pageWith({
    frontMatter: { last_modified_at: "2026-03-04" },
    headings: [heading(2, "Pick a mode"), heading(2, "Finish")],
    html: '<h2 id="pick-a-mode">Pick a mode</h2><p>Choose.</p><h2 id="finish">Finish</h2><p>Done.</p>',
  });
  const data = { "reading-time": [{ url: page.url, words: 400, minutes: 2 }] };
  const html = render(tutorial, page, data);
  assert.match(html, /<h1>Install<\/h1><div class="doc-meta"><p class="last-updated">[\s\S]*?<p class="reading-time"/);
  assert.ok(html.indexOf('class="doc-meta"') < html.indexOf('class="tutorial-progress"'));
});

test("the shared header keeps the breadcrumb quiet, the title balanced, and the facts small", () => {
  const breadcrumb = bodyOf(".breadcrumb");
  assert.match(breadcrumb, /font-size:\s*0?\.75rem/);
  assert.match(breadcrumb, /gap:\s*0?\.375rem/);
  assert.match(bodyOf(".doc-context"), /min-block-size:\s*1\.5rem/);

  const title = bodyOf(".doc-body > h1:first-child,");
  assert.match(title, /text-wrap:\s*balance/);
  assert.match(title, /overflow-wrap:\s*anywhere/);

  assert.match(bodyOf(".doc-description"), /margin-block:\s*0?\.5rem 0/);
  assert.match(bodyOf(".doc-meta"), /margin-block-start:\s*0?\.5rem/);
  assert.match(bodyOf(".doc-meta"), /font-size:\s*0?\.75rem/);
  assert.match(bodyOf(".page-status"), /margin-block:\s*0?\.5rem/);
  assert.match(bodyOf(".page-status"), /font-size:\s*0?\.8125rem/);
});
