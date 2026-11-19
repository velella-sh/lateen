import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { ComponentProps } from "@velella/mizzen/contracts";
import { renderToString } from "preact-render-to-string";
import hero, { alignOf, type HeroProps } from "../components/hero/index.ts";

const actions = [
  { label: "Start", url: "/start/", primary: true },
  { label: "Docs", url: "/docs/" },
  { label: "No url" },
  "junk",
];

function render(props: HeroProps, html = "", lang = "en"): string {
  const input = { props, html, page: { lang, title: "Page title" }, site: {} } as unknown as ComponentProps<HeroProps>;
  const out = hero(input);
  return out === null ? "" : renderToString(out as never);
}

const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;

test("renders eyebrow, h1, lead and actions in reading order", () => {
  const out = render({ eyebrow: "New", title: "Hello", lead: "Lead", actions });
  const order = ["hero-eyebrow", "<h1", "hero-lead", "hero-actions"].map((m) => out.indexOf(m));
  assert.ok(order.every((i) => i >= 0) && [...order].sort((a, b) => a - b).join() === order.join());
  assert.equal(count(out, /<a /g), 2);
  assert.match(out, /hero-btn-primary" href="\/start\/"/);
  assert.match(out, /hero-btn-quiet" href="\/docs\/"/);
});

test("start is the default and unknown alignments fall back to it", () => {
  assert.match(render({ title: "T" }), /class="hero hero-start"/);
  assert.match(render({ title: "T", align: "wide" }), /hero-start/);
  assert.equal(alignOf("center"), "center");
});

test("centre alignment", () => {
  assert.match(render({ title: "T", align: "center" }), /class="hero hero-center"/);
});

test("split alignment puts the visual after the text, never before", () => {
  const out = render({ title: "T", lead: "L", actions, align: "split" }, "<p>visual</p>");
  assert.match(out, /class="hero hero-split"/);
  assert.ok(out.indexOf("hero-actions") < out.indexOf("hero-visual"));
  assert.match(out, /<div class="hero-visual"><p>visual<\/p><\/div>/);
});

test("without a visual there is no visual slot, and split becomes start", () => {
  const out = render({ title: "T", align: "split" });
  assert.doesNotMatch(out, /hero-visual/);
  assert.match(out, /hero-start/);
  assert.doesNotMatch(render({ title: "T" }, "  \n"), /hero-visual/);
});

test("the component adds no image of its own", () => {
  assert.doesNotMatch(render({ title: "T", lead: "L", actions }), /<img|<svg|<picture/);
});

test("one h1; the title falls back to the page title", () => {
  const out = render({});
  assert.equal(count(out, /<h1/g), 1);
  assert.match(out, />Page title<\/h1>/);
  assert.equal(count(render({ title: "A" }, "<p>x</p>"), /<h1/g), 1);
});

test("escapes text", () => {
  const out = render({ title: "<b>x</b>", eyebrow: "<i>", lead: "a & b", actions: [{ label: "<s>", url: "/x" }] });
  assert.doesNotMatch(out, /<b>|<i>|<s>/);
  assert.match(out, /a &amp; b/);
});

