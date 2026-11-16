import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import embedded from "../layouts/embedded.ts";
import { html, layoutProps, pageWith, siteWith } from "./helpers-embed.ts";

const css = readFileSync(new URL("../layouts/embedded.css", import.meta.url), "utf8");
const render = (embeddedFm: Record<string, unknown>) => {
  const page = pageWith({ frontMatter: { embedded: embeddedFm } });
  return html(embedded(layoutProps(page, siteWith([page]))));
};

for (const scheme of ["light", "dark", "auto"]) {
  test(`scheme ${scheme} reaches the root as data-scheme`, () => {
    assert.match(render({ scheme }), new RegExp(`<html[^>]* data-scheme="${scheme}"`));
  });
}

test("an unknown scheme falls back to auto", () => {
  assert.match(render({ scheme: "sepia" }), /data-scheme="auto"/);
});

test("transparent canvas is a data attribute the stylesheet reads", () => {
  assert.match(render({ transparent: true }), /data-transparent="true"/);
  assert.match(render({}), /data-transparent="false"/);
  assert.match(css, /data-transparent="true"[\s\S]*background-color: transparent/);
});

test("the stylesheet fixes color-scheme per published scheme and reads no query parameter", () => {
  assert.match(css, /html\[data-scheme="light"\]\s*\{\s*color-scheme: light/);
  assert.match(css, /html\[data-scheme="dark"\]\s*\{\s*color-scheme: dark/);
  assert.doesNotMatch(render({}), /location|URLSearchParams|<script/);
});
