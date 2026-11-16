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

test("a long title stays in the h1 and wraps instead of overflowing", () => {
  const long = "Supercalifragilisticexpialidocious ".repeat(12) + "x".repeat(200);
  const out = render({ title: long });
  assert.ok(out.includes(`>${long}</h1>`));
  const css = readFileSync(new URL("../components/hero/style.css", import.meta.url), "utf8");
  assert.match(css, /overflow-wrap:\s*anywhere/);
});

test("escapes text", () => {
  const out = render({ title: "<b>x</b>", eyebrow: "<i>", lead: "a & b", actions: [{ label: "<s>", url: "/x" }] });
  assert.doesNotMatch(out, /<b>|<i>|<s>/);
  assert.match(out, /a &amp; b/);
});

test("right-to-left: Persian text renders as given and the css uses logical properties and the display token", () => {
  const out = render({ eyebrow: "تازه", title: "عنوان بسیار بلند فارسی", lead: "توضیح", actions: [{ label: "شروع", url: "/fa/" }], align: "center" }, "<p>تصویر</p>", "fa");
  assert.match(out, /عنوان بسیار بلند فارسی<\/h1>/);
  const css = readFileSync(new URL("../components/hero/style.css", import.meta.url), "utf8");
  assert.doesNotMatch(css, /(margin|padding|border)-(left|right)|text-align:\s*(left|right)|\bleft:|\bright:/);
  assert.match(css, /font-size:\s*var\(--type-size-display\)/);
  const rtl = readFileSync(new URL("../styles/rtl.css", import.meta.url), "utf8");
  assert.match(rtl, /--type-size-display:\s*var\(--rtl-size-display\)/);
  const tokens = readFileSync(new URL("../styles/tokens.css", import.meta.url), "utf8");
  assert.match(tokens, /--rtl-size-display:/);
  assert.match(tokens, /--type-size-display:\s*clamp\(/);
});
