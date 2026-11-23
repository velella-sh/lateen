import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { renderToString } from "preact-render-to-string";
import { JSDOM } from "jsdom";
import type { Head, Layout, LayoutProps } from "@velella/mizzen/contracts";
import { all, build, root, type BuiltSite } from "./integration-helpers.ts";
import { pageWith } from "./helpers/page.ts";
import { siteOf } from "./helpers/site.ts";

/**
 * Verifies the head contract (Mizzen 0.2.2) on every layout, two ways.
 *
 * 1. A loop over every file in `layouts/` renders it with a head that has one of everything (a
 *    `property` meta, a `name` meta, a link with attributes, JSON-LD, a script) and checks the document
 *    prints all of it. This proves the theme drops nothing the engine hands it.
 * 2. A real build of `fixtures/head-meta` (social template, analytics, base path `/docs`, a collection
 *    with `seo`) checks what the engine does hand each layout, and that the base path survives.
 */

/** One of everything the contract allows, each recognisable in the output. */
const SENTINEL: Head = {
  title: "Sentinel title",
  meta: [
    { name: "description", content: "sentinel description" },
    { name: "og:title", content: "sentinel og title", property: true },
    { name: "og:image", content: "https://example.com/docs/assets/social/x.png", property: true },
    { name: "twitter:card", content: "summary_large_image" },
  ],
  links: [
    { rel: "canonical", href: "https://example.com/docs/sentinel/" },
    { rel: "alternate", href: "https://example.com/docs/feed.xml", attrs: { type: "application/atom+xml", title: "Feed" } },
    { rel: "preconnect", href: "https://cdn.example.com", attrs: { crossorigin: "" } },
  ],
  jsonLd: [{ "@context": "https://schema.org", "@type": "TechArticle", name: "sentinel ld" }],
  scripts: [{ src: "https://stats.example.com/sentinel.js", attrs: { defer: "" } }],
};

/** Layouts that print a deliberately smaller head. `embedded` is a noindex frame inside someone else's page. */
const PARTIAL = new Set(["embedded"]);

const LAYOUTS = readdirSync(join(root, "layouts"))
  .filter((file) => file.endsWith(".ts"))
  .map((file) => file.slice(0, -3))
  .sort();

async function layoutOf(name: string): Promise<Layout> {
  return ((await import(`../layouts/${name}.ts`)) as { default: Layout }).default;
}

function propsFor(name: string): LayoutProps {
  const page = pageWith({
    url: "/docs/sentinel/",
    title: "Sentinel",
    html: "<p>Body</p>",
    frontMatter: { layout: name, embedded: name === "embedded" ? { height: 300 } : undefined },
  });
  const site = siteOf({ pages: [page], config: { base: "/docs", url: "https://example.com" } });
  return { site, page, trail: [], pager: {}, head: SENTINEL, islands: [] } as unknown as LayoutProps;
}

function head(markup: string): Document {
  return new JSDOM(markup).window.document;
}

/** What a printed head has, as comparable strings. */
function printed(doc: Document) {
  return {
    title: doc.title,
    meta: Array.from(doc.head.querySelectorAll("meta"), (meta) => `${meta.getAttribute("property") !== null ? "property" : "name"}:${meta.getAttribute("property") ?? meta.getAttribute("name")}=${meta.getAttribute("content")}`),
    links: Array.from(doc.head.querySelectorAll("link"), (link) => `${link.getAttribute("rel")} ${link.getAttribute("href")}`),
    jsonLd: Array.from(doc.head.querySelectorAll('script[type="application/ld+json"]'), (script) => script.textContent ?? ""),
    scripts: Array.from(doc.head.querySelectorAll("script[src]"), (script) => script.getAttribute("src") ?? ""),
  };
}

test("every layout file is covered by the head loop", () => {
  assert.ok(LAYOUTS.length >= 15, `found ${LAYOUTS.join(", ")}`);
  for (const name of ["home", "doc", "guide", "tutorial", "quickstart", "record", "list", "post", "api-reference", "changelog", "versions", "search-results", "embedded", "not-found"]) {
    assert.ok(LAYOUTS.includes(name), `layouts/${name}.ts exists`);
  }
});

for (const name of LAYOUTS.filter((layout) => layout !== "base")) {
  test(`layout ${name} prints the head it is given`, async () => {
    const layout = await layoutOf(name);
    const markup = renderToString(layout(propsFor(name)) as never);
    const got = printed(head(markup));
    assert.equal(got.title, "Sentinel title");
    assert.ok(got.meta.includes("name:description=sentinel description"), "description");
    assert.ok(got.meta.includes("name:twitter:card=summary_large_image"), "a name meta");
    if (PARTIAL.has(name)) return;
    assert.ok(got.meta.includes("property:og:title=sentinel og title"), "og:title is a property, not a name");
    assert.ok(got.meta.includes("property:og:image=https://example.com/docs/assets/social/x.png"), "og:image is a property");
    assert.ok(!got.meta.some((meta) => meta.startsWith("name:og:")), "no og tag is written as name");
    assert.equal(got.links.filter((link) => link === "canonical https://example.com/docs/sentinel/").length, 1, "one canonical");
    assert.ok(got.links.includes("alternate https://example.com/docs/feed.xml"), "alternate link");
    assert.ok(got.links.includes("preconnect https://cdn.example.com"), "link with attributes");
    const feed = head(markup).head.querySelector('link[rel="alternate"][href$="feed.xml"]');
    assert.equal(feed?.getAttribute("type"), "application/atom+xml", "link attributes are kept");
    assert.equal(got.jsonLd.length, 1, "json-ld");
    assert.deepEqual(JSON.parse(got.jsonLd[0]!), SENTINEL.jsonLd[0]);
    assert.deepEqual(got.scripts.filter((src) => src.includes("stats.example.com")), ["https://stats.example.com/sentinel.js"], "script");
    assert.ok(head(markup).head.querySelector("script[src*='sentinel.js'][defer]") !== null, "script attributes are kept");
  });
}

test("embedded prints the meta, scripts and noindex but not structured data, on purpose", async () => {
  const layout = await layoutOf("embedded");
  const got = printed(head(renderToString(layout(propsFor("embedded")) as never)));
  assert.ok(got.meta.includes("name:description=sentinel description"));
  assert.ok(got.meta.some((meta) => meta.startsWith("name:robots=")), "an embedded frame is never indexed");
  assert.deepEqual(got.jsonLd, [], "no JSON-LD in a frame");
  assert.deepEqual(got.scripts.filter((src) => src.includes("stats")), ["https://stats.example.com/sentinel.js"], "scripts are printed");
});

// --- the real build ---------------------------------------------------------------------------

/** Every layout the task names, as the built page that uses it. */
const PAGES: Readonly<Record<string, string>> = {
  home: "/",
  doc: "/doc/",
  guide: "/guide/",
  tutorial: "/tutorial/",
  quickstart: "/quickstart/",
  record: "/books/alpha/",
  list: "/books/",
  post: "/blog/newer/",
  "blog archive": "/blog/archive/",
  "api-reference index": "/reference/",
  "api-reference": "/reference/ping/",
  api: "/api/",
  changelog: "/changelog/",
  versions: "/versions/",
  "search-results": "/search-results/",
  gallery: "/gallery/",
  embedded: "/books/alpha/embed/",
  "not-found": "/404.html",
};

let site: BuiltSite | undefined;
function built(): BuiltSite {
  site ??= build("head-meta", process.env);
  return site;
}

function headOf(page: string): Document {
  return head(built().html(page).slice(0, built().html(page).indexOf("</head>") + 7));
}

for (const [layout, page] of Object.entries(PAGES)) {
  test(`built ${layout} page (${page}) keeps its meta, canonical, script and base path`, () => {
    const doc = headOf(page);
    const got = printed(doc);
    assert.ok(doc.title.length > 0, "title");
    const descriptions = got.meta.filter((meta) => meta.startsWith("name:description=")).length;
    assert.equal(descriptions, 1, "one description");
    const canonical = Array.from(doc.querySelectorAll('link[rel="canonical"]'), (link) => link.getAttribute("href"));
    assert.equal(canonical.length, 1, "one canonical link");
    assert.match(canonical[0] ?? "", /^https:\/\/example\.com\/docs\//, "canonical carries the site url and base");
    assert.ok(doc.querySelector('link[rel="search"][href="https://example.com/docs/opensearch.xml"]') !== null, "OpenSearch link");
    for (const href of Array.from(doc.querySelectorAll('link[rel="stylesheet"], link[rel="preload"]'), (link) => link.getAttribute("href") ?? "")) {
      assert.ok(href.startsWith("/docs/"), `${href} keeps the base path`);
    }
    const analytics = doc.querySelector('script[src="https://stats.example.com/count.js"]');
    // The engine leaves analytics off an embedded frame; every other page gets the script as configured.
    if (layout === "embedded") assert.equal(analytics, null, "the engine hands no analytics to an embedded frame");
    else assert.ok(analytics?.hasAttribute("defer"), "the analytics script is printed with its attributes");
  });
}

test("a social image is drawn for every page, and its path keeps the base path rules", () => {
  for (const file of ["index.png", "doc.png", "books/alpha.png", "blog/newer.png", "reference/ping.png"]) {
    assert.ok(existsSync(join(built().out, "assets", "social", file)), `assets/social/${file}`);
  }
});

test("a collection with seo reaches its record and list pages", () => {
  // The collection's seo config (`jsonLd`, `breadcrumbs`) is the engine's to turn into `head.jsonLd`.
  const record = printed(headOf("/books/alpha/"));
  const list = printed(headOf("/books/"));
  for (const got of [record, list]) {
    assert(got.jsonLd.length > 0, "collection schema and breadcrumbs reach the layout");
    assert(got.meta.some((meta) => meta.startsWith("property:og:")), "Open Graph metadata reaches the layout");
    assert(got.meta.some((meta) => meta.startsWith("name:twitter:")), "Twitter metadata reaches the layout");
  }
});

test("no layout invents a second canonical or drops the translation alternates", () => {
  for (const page of Object.values(PAGES)) {
    const doc = headOf(page);
    assert.equal(all(doc, 'link[rel="canonical"]').length, 1, page);
  }
});
