// A page with nothing to zoom pays nothing for zoom: no panel markup, no zoom script and no zoom class
// in its HTML, so the performance budgets need no raise (#1469).
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { articleHtml, imageZoom } from "../src/article-html.ts";
import { build } from "./integration-helpers.ts";

const PLAIN = `---
title: Plain
layout: doc
permalink: /plain/
---

A paragraph with a small image: ![Small](/s.png){width=300}

::figure{src="/f.png" alt="A figure" caption="No zoom." width="1200" height="600"}
`;

const ZOOMED = PLAIN.replace('caption="No zoom."', 'caption="Zoom." zoom="true"').replace("/plain/", "/zoomed/");

function scripts(html: string): string[] {
  return [...html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)].map((m) => m[1]!);
}

test("images.zoom changes nothing on a page without a large plain image", () => {
  const source = '<p>Text <img src="/s.png" alt="s" width="300"></p><figure class="figure"><img src="/f.png" alt="f" width="1200"></figure>';
  assert.equal(articleHtml(source, "en", imageZoom({ images: { zoom: "auto" } })), articleHtml(source));
});

test("a built page without zoom has no panel, no zoom class and no extra script", () => {
  const site = build("integration", process.env, { "plain.md": PLAIN, "zoomed.md": ZOOMED });
  const page = (name: string) => readFileSync(join(site.out, name, "index.html"), "utf8");
  const plain = page("plain");
  const zoomed = page("zoomed");
  assert.doesNotMatch(plain, /popover="|class="figure-zoom/);
  assert.match(zoomed, /class="figure-zoom-panel"/);
  // The zoom island is the only script the zoomed page adds; the plain page does not load it.
  const extra = scripts(zoomed).filter((src) => !scripts(plain).includes(src));
  assert.ok(extra.every((src) => /figure/.test(src)), `only the figure island is added: ${extra.join(", ")}`);
  assert.equal(readdirSync(site.out).includes("plain"), true);
});
