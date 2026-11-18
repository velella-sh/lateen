import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { build, outputFile, textOf, type BuiltSite } from "../integration-helpers.ts";

/** The fixture's config with an optional base path. */
const config = (base?: string): string => `title: Version notice fixture
description: Two releases of the same documentation, with one page missing from the current release.
url: https://example.com
${base === undefined ? "" : `base: ${base}\n`}lang: en
`;

const root = build("docs-versions-theme");
const basePath = build("docs-versions-theme", process.env, { "mizzen.yml": config("/docs") });
const switched = build("docs-versions-theme", process.env, {
  "_data/versions.yml": "default: v1\nold: [v2]\n",
});

/** The links the page's sidebar renders, as written in the HTML. */
function sidebarLinks(site: BuiltSite, path: string): string[] {
  return [...site.document(path).querySelectorAll(".sidebar-nav a")].map((link) => link.getAttribute("href") ?? "");
}

/** True when a site path in `urls` has a built HTML file under the site's base. */
function built(site: BuiltSite, url: string, base = ""): boolean {
  const path = base !== "" && url.startsWith(`${base}/`) ? url.slice(base.length) : url;
  try {
    readFileSync(join(site.out, outputFile(path)));
    return true;
  } catch {
    return false;
  }
}

function canonical(site: BuiltSite, path: string): string {
  return site.document(path).querySelector('link[rel="canonical"]')?.getAttribute("href") ?? "";
}

function switcher(site: BuiltSite, path: string): Element[] {
  return [...site.document(path).querySelectorAll(".version-switcher-link")];
}

test("the default release answers at the unprefixed URL and keeps its versioned URL", () => {
  const page = root.document("/guide/install/");
  assert.match(textOf(page.querySelector("article")), /Install the current release\./);
  assert.equal(canonical(root, "/guide/install/"), "https://example.com/guide/install/");

  const versioned = root.document("/v2/guide/install/");
  assert.match(textOf(versioned.querySelector("article")), /Install the current release\./);
  assert.equal(canonical(root, "/v2/guide/install/"), "https://example.com/guide/install/");
  assert.equal(versioned.querySelector(".version-notice")?.getAttribute("data-version-status"), "default");
  assert.equal(
    textOf(versioned.querySelector(".version-notice-link")),
    "Read this page in v1",
  );
});

test("the old release stays at its versioned URL and links the default page", () => {
  const page = root.document("/v1/guide/install/");
  assert.match(textOf(page.querySelector("article")), /Install release 1\./);
  assert.equal(canonical(root, "/v1/guide/install/"), "https://example.com/v1/guide/install/");
  assert.equal(page.querySelector(".version-notice")?.getAttribute("data-version-status"), "old");
  assert.equal(page.querySelector(".version-notice-link")?.getAttribute("href"), "/guide/install/");
  assert.equal(page.querySelector(".version-notice-link")?.getAttribute("data-version-target"), "page");
});

test("a page without an equivalent in the default release links a reachable home", () => {
  const page = root.document("/v1/guide/legacy/");
  const notice = page.querySelector(".version-notice");
  assert.equal(notice?.getAttribute("data-version-status"), "old");
  assert.equal(notice?.querySelector(".version-notice-link")?.getAttribute("href"), "/");
  assert.equal(notice?.querySelector(".version-notice-link")?.getAttribute("data-version-target"), "home");
  assert.equal(textOf(notice?.querySelector(".version-notice-link")), "Go to the v2 home page");
  assert.ok(built(root, "/"), "the notice's home target has no built page");
  assert.match(textOf(root.document("/").querySelector("article")), /Release 2 documentation\./);
});

test("the switcher lists both releases and marks the page's own", () => {
  const current = switcher(root, "/v2/guide/install/");
  assert.deepEqual(current.map((link) => link.getAttribute("href")), ["/v1/guide/install/", "/v2/guide/install/"]);
  assert.deepEqual(current.map((link) => link.getAttribute("aria-current")), [null, "true"]);

  const canonicalPage = switcher(root, "/guide/install/");
  assert.deepEqual(canonicalPage.map((link) => link.getAttribute("href")), ["/v1/guide/install/", "/v2/guide/install/"]);
  assert.deepEqual(canonicalPage.map((link) => link.getAttribute("aria-current")), [null, "true"]);

  const old = switcher(root, "/v1/guide/install/");
  assert.deepEqual(old.map((link) => link.getAttribute("href")), ["/v1/guide/install/", "/v2/guide/install/"]);
  assert.deepEqual(old.map((link) => link.getAttribute("aria-current")), ["true", null]);
});

test("each release keeps its navigation and every sidebar link is a built page", () => {
  const v2 = sidebarLinks(root, "/v2/guide/install/");
  assert.ok(v2.includes("/v2/guide/install/"));
  assert.ok(v2.includes("/v1/guide/install/"));
  assert.equal(
    root.document("/v2/guide/install/").querySelector('a[href="/v2/guide/install/"]')?.getAttribute("aria-current"),
    "true",
  );

  const v1 = sidebarLinks(root, "/v1/guide/install/");
  assert.ok(v1.includes("/v1/guide/install/"));
  assert.equal(
    root.document("/v1/guide/install/").querySelector('a[href="/v1/guide/install/"]')?.getAttribute("aria-current"),
    "true",
  );
  for (const href of [...v2, ...v1]) assert.ok(built(root, href), `sidebar link ${href} has no built page`);
});

test("the versions output records both URLs of the default release", () => {
  const versions = JSON.parse(root.file("versions.json")) as {
    byUrl: Record<string, string>;
  };
  assert.equal(versions.byUrl["/v1/guide/install/"], "guide/install.md");
  assert.equal(versions.byUrl["/v2/guide/install/"], "guide/install.md");
});

test("a base-path build prefixes links, canonicals, notices and the switcher once", () => {
  assert.equal(canonical(basePath, "/guide/install/"), "https://example.com/docs/guide/install/");
  assert.equal(canonical(basePath, "/v2/guide/install/"), "https://example.com/docs/guide/install/");
  assert.equal(canonical(basePath, "/v1/guide/install/"), "https://example.com/docs/v1/guide/install/");

  assert.deepEqual(
    switcher(basePath, "/v2/guide/install/").map((link) => link.getAttribute("href")),
    ["/docs/v1/guide/install/", "/docs/v2/guide/install/"],
  );
  assert.equal(
    basePath.document("/v1/guide/legacy/").querySelector(".version-notice-link")?.getAttribute("href"),
    "/docs/",
  );
  assert.equal(
    basePath.document("/guide/install/").querySelector(".version-notice-link")?.getAttribute("href"),
    "/docs/v1/guide/install/",
  );
  for (const href of sidebarLinks(basePath, "/v1/guide/install/")) {
    assert.ok(href.startsWith("/docs/"), `${href} is missing the base`);
    assert.ok(built(basePath, href, "/docs"), `sidebar link ${href} has no built page`);
  }
});

test("switching the default moves v1 to the unprefixed URLs and keeps v1, v2 reachable", () => {
  assert.match(textOf(switched.document("/guide/install/").querySelector("article")), /Install release 1\./);
  assert.equal(canonical(switched, "/guide/install/"), "https://example.com/guide/install/");

  assert.match(textOf(switched.document("/v1/guide/install/").querySelector("article")), /Install release 1\./);
  assert.equal(canonical(switched, "/v1/guide/install/"), "https://example.com/guide/install/");

  const v2 = switched.document("/v2/guide/install/");
  assert.match(textOf(v2.querySelector("article")), /Install the current release\./);
  assert.equal(canonical(switched, "/v2/guide/install/"), "https://example.com/v2/guide/install/");
  assert.equal(v2.querySelector(".version-notice")?.getAttribute("data-version-status"), "old");
  assert.equal(v2.querySelector(".version-notice-link")?.getAttribute("href"), "/guide/install/");

  const legacy = switched.document("/guide/legacy/");
  assert.match(textOf(legacy.querySelector("article")), /A page that exists only in release 1\./);
  assert.equal(legacy.querySelector(".version-notice")?.getAttribute("data-version-status"), "default");
  assert.equal(legacy.querySelector(".version-notice-link")?.getAttribute("href"), "/v2/");
  assert.ok(built(switched, "/v2/"), "the missing-equivalent target has no built page");
  assert.equal(switched.document("/v1/guide/legacy/").querySelector(".version-notice")?.getAttribute("data-version-status"), "default");
  assert.equal(canonical(switched, "/v1/guide/legacy/"), "https://example.com/guide/legacy/");

  assert.deepEqual(
    switcher(switched, "/guide/install/").map((link) => [link.getAttribute("href"), link.getAttribute("aria-current")]),
    [
      ["/v1/guide/install/", "true"],
      ["/v2/guide/install/", null],
    ],
  );
  assert.equal(canonical(switched, "/"), "https://example.com/");
  assert.match(textOf(switched.document("/").querySelector("article")), /Release 1 documentation\./);
  assert.match(textOf(switched.document("/v2/").querySelector("article")), /Release 2 documentation\./);
});
