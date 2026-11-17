import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToString } from "preact-render-to-string";
import type { NetworkProject, SiteNetwork } from "@velella/mizzen/contracts";
import { searchFailure, searchResult } from "../components/search-result/index.ts";
import { resultHref, resultLabel, type SearchResult } from "../src/search/merge.ts";

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
