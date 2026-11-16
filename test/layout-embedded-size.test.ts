import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import embedded, { embeddedOf } from "../layouts/embedded.ts";
import { html, layoutProps, pageWith, siteWith } from "./helpers-embed.ts";

const css = readFileSync(new URL("../layouts/embedded.css", import.meta.url), "utf8");
const render = (embeddedFm: Record<string, unknown>) => {
  const page = pageWith({ frontMatter: { embedded: embeddedFm } });
  return html(embedded(layoutProps(page, siteWith([page]))));
};

test("the declared height is exposed as data and a custom property", () => {
  const out = render({ height: 480 });
  assert.match(out, /data-embedded-height="480"/);
  assert.match(out, /style="--embedded-height:480px"/);
});

test("height defaults to 360 and is kept within bounds", () => {
  assert.equal(embeddedOf(pageWith()).height, 360);
  assert.equal(embeddedOf(pageWith({ frontMatter: { embedded: { height: 5 } } })).height, 120);
  assert.equal(embeddedOf(pageWith({ frontMatter: { embedded: { height: 99999 } } })).height, 2000);
  assert.equal(embeddedOf(pageWith({ frontMatter: { embedded: { height: "tall" } } })).height, 360);
});

test("the view adapts with container queries and clips instead of scrolling", () => {
  assert.match(css, /container-type: size/);
  assert.match(css, /@container embedded \(max-inline-size: 30rem\)/);
  assert.match(css, /@container embedded \(min-inline-size: 45rem\)/);
  assert.match(css, /\.embedded\s*\{[^}]*overflow: hidden/);
  assert.doesNotMatch(css, /overflow(-[xy])?: (auto|scroll)/);
});

test("the open-full-page link stays visible below the clipped content and no resize message is sent", () => {
  assert.match(render({}), /<\/main><p class="embedded-attribution">/);
  assert.doesNotMatch(render({}), /postMessage/);
});
