import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToString } from "preact-render-to-string";
import type { Heading, LayoutProps, Page, Site, SiteConfig, SourcePos } from "@velella/mizzen/contracts";
import record from "../../layouts/record.ts";

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

const fields = { name: "Button" };

const heading = (depth: Heading["depth"], text: string): Heading => ({
  depth,
  text,
  id: text.toLowerCase().replace(/\s+/g, "-"),
  pos,
});

const sections = [heading(1, "Button"), heading(2, "States"), heading(3, "Hover")];
const sectionsHtml = '<h1 id="button">Button</h1><h2 id="states">States</h2><h3 id="hover">Hover</h3>';

function pageWith(options: { headings?: Heading[]; html?: string; lang?: string; dir?: string } = {}): Page {
  const lang = options.lang ?? "en";
  return {
    url: "/components/button/",
    source: pos,
    frontMatter: { record: { facts: [{ field: "name", label: "Name" }] } },
    title: "Button",
    lang,
    dir: options.dir ?? (lang === "en" ? "ltr" : "rtl"),
    headings: options.headings ?? sections,
    html: options.html ?? sectionsHtml,
    markdown: "",
    kind: "doc",
  } as unknown as Page;
}

function props(page: Page): LayoutProps {
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
    record: { collection: "components", id: "button", url: page.url, fields, links: {} },
  } as unknown as LayoutProps;
}

const render = (page: Page = pageWith()) => renderToString(record(props(page)) as never);

test("the contents put the facts panel first, then the page's h2 and h3 sections", () => {
  const out = render();
  assert.match(out, /<div class="aside"><nav class="toc" aria-labelledby="toc-title">/);
  assert.match(out, /<dl class="key-value" id="record-facts">/);

  const start = out.indexOf('<nav class="toc"');
  const nav = out.slice(start, out.indexOf("</nav>", start));
  const links = [...nav.matchAll(/<a href="#([^"]+)">([^<]+)<\/a>/g)].map((match) => [match[1], match[2]]);
  assert.deepEqual(links, [
    ["record-facts", "Key facts"],
    ["states", "States"],
    ["hover", "Hover"],
  ]);
  assert.match(out, /<details class="toc-fold"><summary><span class="toc-fold-title">On this page<\/span><span class="toc-fold-current" data-toc-current><\/span><\/summary><ul><li><a href="#record-facts">Key facts<\/a>/);

  const fa = render(pageWith({ lang: "fa" }));
  assert.match(fa, /<a href="#record-facts">مشخصات کلیدی<\/a>/);
});

test("a page with facts only hides the contents: one entry is fewer than two", () => {
  const out = render(pageWith({ headings: [], html: "<p>A control that starts an action.</p>" }));
  assert.match(out, /<dl class="key-value" id="record-facts">/);
  assert.doesNotMatch(out, /class="toc"/);
  assert.doesNotMatch(out, /class="toc-fold"/);
  assert.doesNotMatch(out, /class="aside"/);
});

test("every contents link targets an element the scroll spy can observe", () => {
  const out = render();
  const foldStart = out.indexOf('<details class="toc-fold"');
  const fold = out.slice(foldStart, out.indexOf("</details>", foldStart));
  const navStart = out.indexOf('<nav class="toc"');
  const nav = out.slice(navStart, out.indexOf("</nav>", navStart));
  const ids = new Set([...out.matchAll(/ id="([^"]+)"/g)].map((match) => match[1]));
  const hrefs = [...(fold + nav).matchAll(/href="#([^"]+)"/g)].map((match) => match[1]);
  assert.ok(hrefs.length >= 4, "the sticky list and the fold both link every entry");
  for (const href of hrefs) assert.ok(ids.has(href), `#${href} has a target`);
  const labelId = /aria-labelledby="([^"]+)"/.exec(nav)?.[1];
  assert.ok(labelId !== undefined && ids.has(labelId), "the landmark's label exists");
});
