import { componentFields } from "../helpers/render-component.ts";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { renderToString } from "preact-render-to-string";
import type { Page, Site, SiteConfig, SourcePos } from "@velella/mizzen/contracts";
import versionNotice, { noticeOf, versionOf } from "../../components/version-notice/index.ts";
import { build, textOf } from "../integration-helpers.ts";

const pos = (file: string): SourcePos => ({ file, line: 1, column: 1, endLine: 1, endColumn: 1 });

function configWith(overrides: Partial<SiteConfig> = {}): SiteConfig {
  return {
    title: "Example",
    base: "/docs",
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
    ...overrides,
  };
}

function page(file: string, url: string, overrides: Partial<Page> = {}): Page {
  return {
    url,
    source: pos(file),
    frontMatter: { title: "Page" },
    title: "Page",
    lang: "en",
    dir: "ltr",
    headings: [],
    html: "",
    markdown: "",
    kind: "doc",
    ...overrides,
  };
}

/** A two-release site with the fixture's pages: v2 is the default, v1 is old. */
function releases(pages: readonly Page[] = defaultPages(), data: unknown = { default: "v2", old: ["v1"] }): Site {
  return {
    config: configWith(),
    pages,
    nav: {},
    data: { versions: data },
    collections: {},
  };
}

function defaultPages(): Page[] {
  return [
    page("index.md", "/docs/"),
    page("v1/index.md", "/docs/v1/"),
    page("v2/index.md", "/docs/v2/"),
    page("v1/guide/install.md", "/docs/v1/guide/install/"),
    page("v2/guide/install.md", "/docs/v2/guide/install/"),
    page("v1/guide/legacy.md", "/docs/v1/guide/legacy/"),
  ];
}

function render(site: Site, target: Page): string {
  const node = versionNotice({ props: {}, page: target, site, html: "", ...componentFields });
  return node == null ? "" : renderToString(node as never);
}

test("the default release says it is current and links the same page in the old release", () => {
  const site = releases();
  const current = site.pages.find((entry) => entry.url === "/docs/v2/guide/install/");
  assert.ok(current);

  assert.deepEqual(noticeOf(site, current), {
    version: "v2",
    status: "default",
    targetVersion: "v1",
    href: "/docs/v1/guide/install/",
    target: "page",
  });

  const html = render(site, current);
  assert.match(html, /^<div class="version-notice" role="note" data-version="v2" data-version-status="default">/);
  assert.match(html, /<strong class="version-notice-label">Current version<\/strong>/);
  assert.match(html, /<span class="version-notice-version" dir="ltr">v2<\/span>/);
  assert.match(html, /<span class="version-notice-hint">You are reading the current release\.<\/span>/);
  assert.match(
    html,
    /<a class="version-notice-link" href="\/docs\/v1\/guide\/install\/" data-version-target="page">Read this page in v1<\/a>/,
  );
});

test("an old release says it is old and links the equivalent page in the default release", () => {
  const site = releases();
  const old = site.pages.find((entry) => entry.url === "/docs/v1/guide/install/");
  assert.ok(old);

  assert.deepEqual(noticeOf(site, old), {
    version: "v1",
    status: "old",
    targetVersion: "v2",
    href: "/docs/v2/guide/install/",
    target: "page",
  });

  const html = render(site, old);
  assert.match(html, /data-version="v1" data-version-status="old"/);
  assert.match(html, /<strong class="version-notice-label">Old version<\/strong>/);
  assert.match(html, /<span class="version-notice-hint">This page describes an older release\.<\/span>/);
  assert.match(html, /href="\/docs\/v2\/guide\/install\/" data-version-target="page"/);
});

test("the notice treats an alias as its release and links back to the canonical copy", () => {
  const old = page("v1/start.md", "/docs/v1/start/");
  const canonical = page("v2/start.md", "/docs/z-start/");
  const alias = { ...canonical, url: "/docs/v2/start/", aliasOf: canonical.url };
  const site = releases([old, alias, canonical]);
  assert.equal(noticeOf(site, alias)?.version, "v2");
  assert.equal(noticeOf(site, old)?.href, canonical.url);
});

test("a page with no equivalent links the target version's home page that the site publishes", () => {
  const site = releases();
  const legacy = site.pages.find((entry) => entry.url === "/docs/v1/guide/legacy/");
  assert.ok(legacy);

  assert.deepEqual(noticeOf(site, legacy), {
    version: "v1",
    status: "old",
    targetVersion: "v2",
    href: "/docs/v2/",
    target: "home",
  });

  const html = render(site, legacy);
  assert.match(html, /<a class="version-notice-link" href="\/docs\/v2\/" data-version-target="home">Go to the v2 home page<\/a>/);
  assert.doesNotMatch(html, /\/docs\/v2\/guide\/legacy\//);
});

test("without a version home, a page with no equivalent links the site home", () => {
  const pages = defaultPages().filter((entry) => entry.url !== "/docs/v2/");
  const site = releases(pages);
  const legacy = site.pages.find((entry) => entry.url === "/docs/v1/guide/legacy/");
  assert.ok(legacy);

  assert.deepEqual(noticeOf(site, legacy), {
    version: "v1",
    status: "old",
    targetVersion: "v2",
    href: "/docs/",
    target: "site",
  });
  assert.match(render(site, legacy), /href="\/docs\/" data-version-target="site">Go to the site home page<\/a>/);
});

test("with no home page in the model, the notice invents no URL", () => {
  const pages = defaultPages().filter((entry) => !/(^|\/)index\.md$/.test(entry.source.file));
  const site = releases(pages);
  const legacy = site.pages.find((entry) => entry.url === "/docs/v1/guide/legacy/");
  assert.ok(legacy);

  const notice = noticeOf(site, legacy);
  assert.equal(notice?.href, undefined);
  assert.equal(notice?.target, "none");
  const html = render(site, legacy);
  assert.match(html, /data-version-status="old"/);
  assert.doesNotMatch(html, /<a /);
});

test("when the default is the current docs, an old page links the current copy", () => {
  const pages = [
    page("index.md", "/docs/"),
    page("guide/install.md", "/docs/guide/install/"),
    page("v1/guide/install.md", "/docs/v1/guide/install/"),
  ];
  const site = releases(pages, { default: "current", old: ["v1"] });
  const old = site.pages.find((entry) => entry.url === "/docs/v1/guide/install/");
  assert.ok(old);

  assert.deepEqual(noticeOf(site, old), {
    version: "v1",
    status: "old",
    href: "/docs/guide/install/",
    target: "page",
  });
  assert.match(render(site, old), />Read this page in the current docs<\/a>/);
});

test("the default release links the first old release, and none when nothing is old", () => {
  const site = releases(defaultPages(), { default: "v2", old: ["v1", "v0"] });
  const current = site.pages.find((entry) => entry.url === "/docs/v2/guide/install/");
  assert.ok(current);
  assert.equal(noticeOf(site, current)?.targetVersion, "v1");

  const noOld = releases(defaultPages(), { default: "v2", old: [] });
  assert.deepEqual(noticeOf(noOld, current), { version: "v2", status: "default", target: "none" });
  assert.doesNotMatch(render(noOld, current), /<a /);
});

test("a page outside the dispositions has no notice", () => {
  const site = releases();
  assert.equal(noticeOf(site, page("guide/install.md", "/docs/guide/install/")), undefined);
  assert.equal(noticeOf(site, page("v3/guide/install.md", "/docs/v3/guide/install/")), undefined);
  assert.equal(noticeOf({ ...site, data: { versions: { pages: [{ path: "guide/install.md", versions: [] }] } } }, site.pages[1]!), undefined);
  assert.equal(noticeOf({ ...site, data: {} }, site.pages[1]!), undefined);
});

test("the page's version is the first source segment matching the engine's folder rule", () => {
  assert.equal(versionOf(page("v1/guide/install.md", "/docs/v1/guide/install/")), "v1");
  assert.equal(versionOf(page("v1.2.3/guide/install.md", "/docs/v1.2.3/guide/install/")), "v1.2.3");
  assert.equal(versionOf(page("versioned/guide/install.md", "/docs/versioned/guide/install/")), undefined);
  assert.equal(versionOf(page("guide/v1/install.md", "/docs/guide/v1/install/")), undefined);
  assert.equal(versionOf(page("./v2/guide/install.md", "/docs/v2/guide/install/")), "v2");
});

test("the notice works without JavaScript and speaks the page's language under RTL", () => {
  const site = releases();
  const html = render(site, {
    ...site.pages.find((entry) => entry.url === "/docs/v1/guide/install/")!,
    lang: "fa",
    dir: "rtl",
  });

  assert.match(html, /role="note"/);
  assert.match(html, /<strong class="version-notice-label">نسخهٔ قدیمی<\/strong>/);
  assert.match(html, /<span class="version-notice-hint">این صفحه نسخهٔ قدیمی‌تری را توصیف می‌کند\.<\/span>/);
  assert.match(html.replace(/[\u2068\u2069]/g, ""), />این صفحه را در v2 بخوانید<\/a>/);
  assert.match(html, /<span class="version-notice-version" dir="ltr">v1<\/span>/);
  assert.doesNotMatch(html, /<script|tabindex|role="button"/);
});

test("the built fixture shows both releases, keeps old URLs, and falls back to a real home page", () => {
  const site = build("docs-versions-theme");

  const old = site.document("/v1/guide/install/");
  const oldNotice = old.querySelector(".version-notice");
  assert.equal(oldNotice?.getAttribute("data-version-status"), "old");
  assert.equal(oldNotice?.querySelector(".version-notice-label")?.textContent, "Old version");
  assert.equal(oldNotice?.querySelector(".version-notice-link")?.getAttribute("href"), "/guide/install/");
  assert.equal(oldNotice?.querySelector(".version-notice-link")?.getAttribute("data-version-target"), "page");

  const current = site.document("/v2/guide/install/");
  assert.equal(current.querySelector('link[rel="canonical"]')?.getAttribute("href"), "https://example.com/guide/install/");
  const currentNotice = current.querySelector(".version-notice");
  assert.equal(currentNotice?.getAttribute("data-version-status"), "default");
  assert.equal(currentNotice?.querySelector(".version-notice-label")?.textContent, "Current version");
  assert.equal(currentNotice?.querySelector(".version-notice-link")?.getAttribute("href"), "/v1/guide/install/");

  const legacy = site.document("/v1/guide/legacy/");
  const legacyNotice = legacy.querySelector(".version-notice");
  assert.equal(legacyNotice?.querySelector(".version-notice-link")?.getAttribute("href"), "/");
  assert.equal(legacyNotice?.querySelector(".version-notice-link")?.getAttribute("data-version-target"), "home");
  assert.equal(textOf(legacyNotice?.querySelector(".version-notice-link")), "Go to the v2 home page");
  // The fallback names a real built page, not an invented URL.
  assert.match(textOf(site.document("/").querySelector("article")), /Release 2 documentation\./);

  // Both release URLs exist in the output while the default release is v2.
  assert.ok(site.html("/v1/guide/install/").includes("Install release 1."));
  assert.ok(site.html("/v2/guide/install/").includes("Install the current release."));
});
