import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToString } from "preact-render-to-string";
import type { LayoutProps, Page, Site, SiteConfig, SourcePos } from "@velella/mizzen/contracts";
import guideIndex from "../layouts/guide-index.ts";
import { stringsOf } from "../i18n/index.ts";

const pos: SourcePos = { file: "guides/move.md", line: 1, column: 1, endLine: 1, endColumn: 1 };

const config = {
  title: "Example", base: "", lang: "en", dir: "ltr", languages: [], source: ".", include: [], exclude: [],
  navigation: "_data/navigation.yml", defaults: [], theme: { options: {} }, search: { text: 300 }, redirects: {},
  outputs: {}, collections: {},
} as unknown as SiteConfig;

function page(
  title: string,
  url: string,
  frontMatter: Readonly<Record<string, unknown>>,
  extra: Partial<Page> = {},
): Page {
  return {
    url, source: pos, frontMatter, title, lang: "en", dir: "ltr", headings: [], html: "", markdown: "", kind: "doc",
    ...extra,
  } as Page;
}

const migrationFirst = page("Move the database", "/guides/database/", {
  layout: "guide", tags: ["Migration"], order: 1, guide: { time: "15 min", risk: "medium" },
});
const migrationSecond = page("Move the app", "/guides/app/", {
  layout: "guide", tags: ["Migration", "Database"], order: 2,
});
const setupBeta = page("Beta setup", "/guides/beta/", { layout: "guide", tags: ["Setup"], order: 2 });
const setupAlpha = page("Alpha setup", "/guides/alpha/", { layout: "guide", tags: ["Setup"], order: 2 });
const troubleshooting = page("Recover access", "/guides/recover/", {
  layout: "guide", tags: ["Troubleshooting"], order: 3, guide: { from: "v1" },
});
const untaggedZero = page("Zero untagged", "/guides/zero/", { layout: "guide", order: 0 });
const untaggedAlpha = page("Alpha untagged", "/guides/untagged/", { layout: "guide", tags: [] });
const untaggedBeta = page("Beta untagged", "/guides/untagged-beta/", { layout: "guide" });
const docsPage = page("Docs page", "/docs/page/", { layout: "doc", tags: ["Migration"], order: 0 });

function render(pages: readonly Page[]): string {
  const site = { config, pages, nav: { main: [] }, data: {}, collections: {} } as unknown as Site;
  const props = {
    site, page: page("Guides", "/guides/", {}), trail: [], pager: {},
    head: { title: "Guides", meta: [], links: [], jsonLd: [] }, islands: [],
  } as unknown as LayoutProps;
  return renderToString(guideIndex(props) as never);
}

test("three tag groups and the untagged group, in the order of their first guide", () => {
  const html = render([untaggedZero, troubleshooting, setupBeta, migrationSecond, setupAlpha, untaggedAlpha, migrationFirst]);
  const headings = [...html.matchAll(/<h2 class="guide-index-heading">([^<]+) <span class="guide-index-count">(\d+)<\/span><\/h2>/g)];
  assert.deepEqual(
    headings.map((match) => [match[1], match[2]]),
    [["Migration", "2"], ["Setup", "2"], ["Troubleshooting", "1"], ["Other guides", "2"]],
  );
  assert.ok(html.indexOf("data-untagged") > html.indexOf(">Troubleshooting <"));
});

test("guides sort by order, then title, and a guide without a tag still appears", () => {
  const html = render([migrationSecond, setupBeta, setupAlpha, migrationFirst, untaggedAlpha, untaggedZero, untaggedBeta]);
  assert.ok(html.indexOf("Move the database") < html.indexOf("Move the app"));
  assert.ok(html.indexOf("Alpha setup") < html.indexOf("Beta setup"));
  assert.ok(html.indexOf("Zero untagged") < html.indexOf("Alpha untagged"));
  assert.ok(html.indexOf("Alpha untagged") < html.indexOf("Beta untagged"));
  assert.ok(html.indexOf("Alpha untagged") > html.indexOf(">Setup <"));
});

test("time and risk come from the summary bar's formatter; unset facts are left out", () => {
  const html = render([migrationFirst, troubleshooting]);
  const database = html.slice(html.indexOf("Move the database"), html.indexOf("Recover access"));
  assert.match(database, /class="guide-index-fact guide-index-time" data-fact="time"/);
  assert.match(database, /class="guide-index-label">Time<\/span> 15 min/);
  assert.match(database, /class="guide-index-fact guide-index-risk" data-fact="risk"/);
  assert.match(database, /class="guide-index-label">Risk<\/span> medium/);
  const recover = html.slice(html.indexOf("Recover access"));
  assert.doesNotMatch(recover, /data-fact="(?:time|risk)"/);
});

test("only guide pages are listed, and the untagged label exists in every catalog", () => {
  const html = render([migrationFirst, docsPage]);
  assert.ok(html.includes("Move the database"));
  assert.ok(!html.includes("Docs page"));
  for (const lang of ["en", "fa", "ar"] as const) {
    assert.notEqual(stringsOf(lang).guide_untagged, undefined, lang);
  }
});
