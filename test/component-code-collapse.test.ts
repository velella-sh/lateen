import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToString } from "preact-render-to-string";
import type { ComponentProps } from "@velella/mizzen/contracts";
import code, { COLLAPSE_AFTER, highlightFences } from "../components/code/index.ts";
import { readUiCss } from "./ui-css-helpers.ts";

const lines = Array.from({ length: COLLAPSE_AFTER + 5 }, (_, index) => `const value${index} = ${index};`).join("\n");
const fence = `<pre data-src="a.md:3"><code class="language-ts">${lines}\n</code></pre>`;
const short = `<pre data-src="b.md:3"><code class="language-ts">const a = 1;\n</code></pre>`;

test("a long fence starts collapsed and keeps every line in the DOM", () => {
  const out = highlightFences(fence);
  assert.match(out, /^<details class="code-details"><summary class="code-details-summary">Show all<\/summary><pre /);
  assert.doesNotMatch(out, /<details[^>]*\sopen/);
  assert.match(out, /> value0</);
  assert.match(out, /> value24</);
});

test("a short fence stays exactly as it was", () => {
  const out = highlightFences(short);
  assert.doesNotMatch(out, /code-details/);
  assert.match(out, /^<pre class="code"/);
});

test("the label follows the page language", () => {
  assert.match(highlightFences(fence, undefined, "fa"), /<summary class="code-details-summary">نمایش همه<\/summary>/);
  assert.match(highlightFences(fence, undefined, "ar"), /<summary class="code-details-summary">إظهار الكل<\/summary>/);
});

test("the code directive collapses the same long example", () => {
  const input = { props: { lang: "ts" }, html: lines, page: { lang: "fa" }, site: {} } as unknown as ComponentProps<never>;
  const out = renderToString(code(input as never) as never);
  assert.match(out, /^<details class="code-details"><summary class="code-details-summary">نمایش همه<\/summary><pre /);
  assert.match(out, /> value24</);
});

test("the disclosure is native: no script, button, or hidden attribute", () => {
  const out = highlightFences(fence);
  assert.doesNotMatch(out, /<script|<button|hidden/);
  assert.match(out, /<\/pre><\/details>$/);
});

test("the stylesheet uses logical spacing and no physical side", () => {
  const css = readUiCss();
  const rule = /\.code-details-summary \{([\s\S]*?)\}/.exec(css)?.[1] ?? "";
  assert.match(rule, /margin-block-end/);
  assert.doesNotMatch(rule, /\b(?:left|right)\b|margin-inline-(?:start|end)/);
});
