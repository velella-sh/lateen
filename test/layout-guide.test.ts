import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { renderToString } from "preact-render-to-string";
import type { LayoutProps, Page, Site, SiteConfig, SourcePos } from "@velella/mizzen/contracts";
import doc from "../layouts/doc.ts";
import guide from "../layouts/guide.ts";

const pos: SourcePos = { file: "guides/move.md", line: 1, column: 1, endLine: 1, endColumn: 1 };

const config = {
  title: "Example", base: "", lang: "en", dir: "ltr", languages: [], source: ".", include: [], exclude: [],
  navigation: "_data/navigation.yml", defaults: [], theme: { options: {} }, search: { text: 300 }, redirects: {},
  outputs: {}, collections: {},
} as unknown as SiteConfig;

function pageWith(overrides: Partial<Page> = {}): Page {
  return {
    url: "/guides/move/", source: pos, frontMatter: {}, title: "Move to v2", lang: "en", dir: "ltr",
    headings: [{ depth: 2, text: "Prepare", id: "prepare", pos }, { depth: 2, text: "Run", id: "run", pos }], html: '<h2 id="prepare">Prepare</h2><p>Back up.</p><h2 id="run">Run</h2>',
    markdown: "Back up.", kind: "doc", ...overrides,
  } as Page;
}

function propsOf(page: Page): LayoutProps {
  const site = { config, pages: [page], nav: { main: [] }, data: {}, collections: {} } as unknown as Site;
  return {
    site, page, trail: [], pager: {},
    head: { title: page.title, meta: [], links: [], jsonLd: [] }, islands: [],
  } as unknown as LayoutProps;
}

const render = (layout: typeof guide, page: Page): string => renderToString(layout(propsOf(page)) as never);

test("builds a guide frame: article, summary bar, body", () => {
  const html = render(guide, pageWith({ frontMatter: { guide: { from: "v1", to: "v2", time: "10 min", risk: "low" } } }));
  assert.match(html, /<article class="doc guide" data-pagefind-body="true">/);
  assert.match(html, /<h1>Move to v2<\/h1>/);
  assert.ok(html.indexOf("guide-summary") > html.indexOf("<h1>"));
  assert.ok(html.indexOf("guide-body") > html.indexOf("guide-summary"));
});

test("reuses the doc layout's navigation and table of contents", () => {
  const page = pageWith();
  const g = render(guide, page);
  const d = render(doc, page);
  for (const marker of ['<nav class="toc"', 'class="sidebar"', 'toc-fold']) {
    assert.equal(g.includes(marker), d.includes(marker), marker);
  }
  assert.ok(g.includes('<nav class="toc"'));
});

test("a body h1 is not duplicated", () => {
  const page = pageWith({ headings: [{ depth: 1, text: "Own", id: "own", pos }], html: '<h1 id="own">Own</h1>' });
  assert.equal(render(guide, page).match(/<h1\b/g)?.length, 1);
});

test("layout source carries no product name and leaves tutorial alone", () => {
  const source = readFileSync(new URL("../layouts/guide.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source.replace(/@velella\/mizzen\/contracts/g, ""), /\bmizzen\b/i);
});

