import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import embedded from "../layouts/embedded.ts";
import { html, layoutProps, pageWith, siteWith } from "./helpers-embed.ts";

const css = "" /* lateen-legacy removed: layouts/embedded.css */;
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

