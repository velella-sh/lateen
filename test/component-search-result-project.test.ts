import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToString } from "preact-render-to-string";
import type { NetworkProject, SiteNetwork } from "@velella/mizzen/contracts";
import { searchFailure, searchResult } from "../components/search-result/index.ts";
import { resultHref, resultLabel, sectionPaths, type SearchResult } from "../src/search/merge.ts";

function project(id: string, title: string, current = false): NetworkProject {
  return { id, path: id, title, current };
}

const network: SiteNetwork = {
  current: "alpha",
  lock: "0".repeat(64),
  projects: [project("alpha", "Alpha", true), project("beta", "Beta Docs"), project("gamma", "Gamma")],
};

function result(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    project: "beta",
    current: false,
    title: "Install",
    url: "/guide/install/",
    excerpt: "How to install.",
    score: 5,
    ...overrides,
  };
}

test("a result from another project carries that project's title; this project's results do not", () => {
  const other = renderToString(searchResult({ result: result(), network }) as never);
  assert.match(other, /<span class="search-result-project"><bdi>Beta Docs<\/bdi><\/span>/);

  const own = renderToString(searchResult({ result: result({ project: "alpha", current: true }), network }) as never);
  assert.doesNotMatch(own, /search-result-project/);
  assert.equal(resultLabel(result({ project: "alpha", current: true }), network), undefined);
  assert.equal(resultLabel(result(), network), "Beta Docs");
});

test("the link is built from the network's path, so another project's base is kept", () => {
  assert.equal(resultHref(result(), network), "/beta/guide/install/");
  assert.equal(resultHref(result({ url: "guide/install/" }), network), "/beta/guide/install/");
  assert.equal(resultHref(result({ url: "/beta/guide/install/" }), network), "/beta/guide/install/");
  assert.equal(resultHref(result({ project: "alpha", current: true, url: "/alpha/guide/" }), network), "/alpha/guide/");
  assert.equal(resultHref(result({ project: "gone", url: "/guide/" }), network), "/guide/");

  const out = renderToString(searchResult({ result: result(), network }) as never);
  assert.match(out, /<a class="search-result-link" href="\/beta\/guide\/install\/">/);
});

test("two pages with the same title carry the section path that tells them apart", () => {
  const urls = ["/api/install/", "/guide/install/"];
  const [apiPath, guidePath] = sectionPaths(urls);
  const api = renderToString(searchResult({ result: result({ title: "Install", url: urls[0]! }), network, path: apiPath }) as never);
  const guide = renderToString(
    searchResult({ result: result({ project: "alpha", current: true, title: "Install", url: urls[1]! }), path: guidePath }) as never,
  );

  assert.match(api, /<a class="search-result-link" href="\/beta\/api\/install\/"><span class="search-result-path"><bdi>\/api\/<\/bdi><\/span><span class="search-result-title">Install<\/span>/);
  assert.match(guide, /<span class="search-result-path"><bdi>\/guide\/<\/bdi><\/span><span class="search-result-title">Install<\/span>/);
});

test("a result with no path, or one every result shares, omits the path element", () => {
  const root = renderToString(searchResult({ result: result({ url: "/install/" }) }) as never);
  assert.doesNotMatch(root, /search-result-path/);
  assert.match(root, /<span class="search-result-title">Install<\/span>/);

  assert.deepEqual(sectionPaths(["/guide/one/", "/guide/two/"]), ["", ""]);
  const shared = renderToString(searchResult({ result: result(), path: "" }) as never);
  assert.doesNotMatch(shared, /search-result-path/);
});

test("a right-to-left page keeps its path isolated and its title and excerpt intact", () => {
  const out = renderToString(
    searchResult({
      result: result({ title: "نصب", url: "/راهنما/نصب/", excerpt: "نصب <mark>کش</mark> پس از انتشار." }),
      path: "/راهنما/",
    }) as never,
  );

  assert.match(out, /<span class="search-result-path"><bdi>\/راهنما\/<\/bdi><\/span>/);
  assert.match(out, /<span class="search-result-title">نصب<\/span>/);
  assert.match(out, /<span class="search-result-excerpt">نصب <mark>کش<\/mark> پس از انتشار\.<\/span>/);
});

test("a result in the page's language carries no language label", () => {
  const out = renderToString(searchResult({ result: result({ lang: "en" }), lang: "en" }) as never);
  assert.doesNotMatch(out, /search-result-language/);
});

test("a result in another language carries that language's real name in a muted label", () => {
  const out = renderToString(searchResult({ result: result({ lang: "de" }), lang: "en" }) as never);
  assert.match(out, /<span class="search-result-language"><bdi>German<\/bdi><\/span>/);
});

test("a result from another site version carries that version; the same version is silent", () => {
  const other = renderToString(searchResult({ result: result({ version: "v1" }), version: "v2" }) as never);
  assert.match(other, /<span class="search-result-version"><bdi>v1<\/bdi><\/span>/);

  const same = renderToString(searchResult({ result: result({ version: "v2" }), version: "v2" }) as never);
  assert.doesNotMatch(same, /search-result-version/);
});

test("in an RTL page the language and version names are isolated and localized", () => {
  const out = renderToString(
    searchResult({ result: result({ lang: "de", version: "v1" }), lang: "fa", version: "v2" }) as never,
  );
  assert.match(out, /<span class="search-result-language"><bdi>آلمانی<\/bdi><\/span>/);
  assert.match(out, /<span class="search-result-version"><bdi>v1<\/bdi><\/span>/);
});

test("an excerpt keeps Pagefind's mark around the match and reads its entities", () => {
  const out = renderToString(
    searchResult({ result: result({ excerpt: "Install <mark>Lateen &amp; Co</mark> now" }) }) as never,
  );
  assert.match(out, /<span class="search-result-excerpt">Install <mark>Lateen &amp; Co<\/mark> now<\/span>/);
});

test("a failed index shows a clear message and a retry link, in all three languages", () => {
  const cases = [
    ["en", "Results from Beta Docs did not load.", "Try again"],
    ["fa", "نتایج «Beta Docs» بارگذاری نشد.", "تلاش دوباره"],
    ["ar", "تعذّر تحميل نتائج «Beta Docs».", "حاول مرة أخرى"],
  ] as const;

  for (const [lang, message, retry] of cases) {
    const out = renderToString(
      searchFailure({ project: { id: "beta", title: "Beta Docs" }, retryUrl: "/alpha/search/?q=install&scope=all", lang }) as never,
    );
    const text = out.replace(/[\u2066-\u2069]/g, "");
    assert.ok(text.includes(message), lang);
    assert.ok(text.includes(retry), lang);
    assert.match(out, /role="status"/);
    assert.match(out, /href="\/alpha\/search\/\?q=install&amp;scope=all"/);
  }
});
