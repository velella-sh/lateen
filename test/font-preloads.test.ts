// A page that brings its own font family must not preload the theme's replaced family. The engine
// still declares the shipped face as a fallback, so the stack and its glyph coverage stay; only the
// preload link and the request it starts are left out. Sans and mono are replaced independently, and
// a site with no custom fonts keeps every preload it had. These fixtures differ only in their brand.
import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { test } from "node:test";
import { build } from "./integration-helpers.ts";

/** The preload URLs a built page asks for, in document order. */
const preloads = (html: string): string[] =>
  [...html.matchAll(/<link rel="preload" as="font"[^>]*href="([^"]+)"/g)].map((match) => match[1] ?? "");

const sans = (url: string): boolean => /\/fonts\/manrope\/[^/]+\.woff2$/.test(url);
const mono = (url: string): boolean => /\/fonts\/jetbrains-mono\/[^/]+\.woff2$/.test(url);

/** Builds one fixture, reads its home page, and removes the output. */
function home(name: string): string {
  const site = build(name);
  try {
    return site.html("/");
  } finally {
    rmSync(site.out, { recursive: true, force: true });
  }
}

test("a site without custom fonts keeps every shipped preload", () => {
  const urls = preloads(home("fonts-default"));
  assert.equal(urls.filter(sans).length, 3, "three sans weights are preloaded");
  assert.equal(urls.filter(mono).length, 2, "two mono weights are preloaded");
});

test("a custom sans family leaves out only the sans preloads", () => {
  const html = home("fonts-sans");
  const urls = preloads(html);
  assert.equal(urls.filter(sans).length, 0);
  assert.equal(urls.filter(mono).length, 2, "the mono family was not replaced");
  assert.match(html, /@font-face \{ font-family: "Example Sans";/);
  assert.match(html, /--type-font-body: "Example Sans", Manrope, "Manrope Fallback", Vazirmatn,/);
});

test("a custom mono family leaves out only the mono preloads", () => {
  const html = home("fonts-mono");
  const urls = preloads(html);
  assert.equal(urls.filter(sans).length, 3, "the sans family was not replaced");
  assert.equal(urls.filter(mono).length, 0);
  assert.match(html, /@font-face \{ font-family: "Example Mono";/);
  assert.match(html, /--type-font-mono: "Example Mono", JetBrains Mono, "JetBrains Mono Fallback", ui-monospace, monospace;/);
});

test("custom sans and mono families leave out both shipped preloads and keep both fallbacks", () => {
  const html = home("fonts-both");
  const urls = preloads(html);
  assert.equal(urls.filter(sans).length, 0);
  assert.equal(urls.filter(mono).length, 0);
  assert.doesNotMatch(html, /<link rel="preload" as="font"/, "no shipped font is preloaded");
  assert.match(html, /@font-face \{ font-family: "Example Sans";/);
  assert.match(html, /@font-face \{ font-family: "Example Mono";/);
  assert.match(html, /--type-font-body: "Example Sans", Manrope, "Manrope Fallback", Vazirmatn,/);
  assert.match(html, /--type-font-mono: "Example Mono", JetBrains Mono, "JetBrains Mono Fallback", ui-monospace, monospace;/);
});
