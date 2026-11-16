import assert from "node:assert/strict";
import { test } from "node:test";
import embedded, { embeddedOf } from "../layouts/embedded.ts";
import { html, layoutProps, pageWith, siteWith } from "./helpers-embed.ts";

const render = (frontMatter: Record<string, unknown>, url = "https://example.com", links: { rel: string; href: string }[] = []) => {
  const page = pageWith({ frontMatter });
  return html(embedded(layoutProps(page, siteWith([page], { url }), links)));
};

test("renders the body without chrome, islands or any script", () => {
  const out = render({ embedded: { of: "/guide/" } });
  assert.doesNotMatch(out, /<script/);
  assert.doesNotMatch(out, /<header|<nav|<aside|<footer|<form|data-js|data-theme/);
  assert.doesNotMatch(out, /\/x\.js/);
  assert.match(out, /<main class="embedded-content"><p>Body<\/p><\/main>/);
});

test("attribution links to the full page in the top window", () => {
  const out = render({ embedded: { of: "/guide/" } });
  assert.match(out, /<a href="https:\/\/example\.com\/guide\/" target="_top" rel="noopener">Open the full page<\/a>/);
  assert.match(out, /From Example\./);
});

test("an absolute `of` is kept; a path without a site url stays relative", () => {
  assert.match(render({ embedded: { of: "https://other.org/x/" } }), /href="https:\/\/other\.org\/x\/" target="_top"/);
  assert.match(render({ embedded: { of: "/guide/" } }, ""), /<a href="\/guide\/" target="_top"/);
  assert.doesNotMatch(render({ embedded: {} }), /<a /);
});

test("sets noindex and a canonical link to the full page, replacing the engine's", () => {
  const out = render({ embedded: { of: "/guide/" } }, "https://example.com", [{ rel: "canonical", href: "https://example.com/embed/guide/" }]);
  assert.equal(out.match(/rel="canonical"/g)?.length, 1);
  assert.match(out, /<link rel="canonical" href="https:\/\/example\.com\/guide\/">/);
  assert.equal(out.match(/name="robots"/g)?.length, 1);
  assert.match(out, /<meta name="robots" content="noindex">/);
});

test("keeps the page language and direction", () => {
  const page = pageWith({ lang: "fa", dir: "rtl", frontMatter: { embedded: { of: "/g/" } } });
  const out = html(embedded(layoutProps(page, siteWith([page], { url: "https://e.com" }))));
  assert.match(out, /<html lang="fa" dir="rtl"/);
  assert.match(out, /باز کردن صفحهٔ کامل/);
});

test("embeddedOf normalises front matter", () => {
  assert.deepEqual(embeddedOf(pageWith()), { of: undefined, scheme: "auto", height: 360, transparent: false });
  assert.deepEqual(embeddedOf(pageWith({ frontMatter: { embedded: { of: " /a/ ", scheme: "dark", height: "500", transparent: true } } })), {
    of: "/a/", scheme: "dark", height: 500, transparent: true,
  });
});
