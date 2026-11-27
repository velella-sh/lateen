// The list layout styles (styles/src/list.css) tune the page-level index: record rows, group
// sections, the dated and changes views, the blog archive, pagination, and the subscribe panel.
// This test reads the sheet through the same inlined entry the other stylesheet tests use, and
// fails when a rule escapes the `<article class="list">` root — which is how the legacy
// `<div class="list">` prose helper once leaked a two-column grid onto every link in the article.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { readUiCss } from "./ui-css-helpers.ts";

const source = readFileSync(new URL("../styles/src/list.css", import.meta.url), "utf8");
const ui = readUiCss();

/** Every innermost `{ ... }` block: its selector and its declarations. */
function blocks(text: string): { selector: string; body: string }[] {
  const stripped = text.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " "));
  return [...stripped.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
    selector: (match[1] ?? "").trim(),
    body: match[2] ?? "",
  }));
}

/** The selectors of one prelude, split on the commas outside parentheses. */
function selectors(prelude: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of prelude) {
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if (char === "," && depth === 0) {
      out.push(current.trim());
      current = "";
    } else current += char;
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

/** True when a selector's leftmost compound is the list article root or reaches it through `:is()`. */
function rooted(selector: string): boolean {
  const s = selector.trim();
  if (s === ".list" || s.startsWith(".list ") || s.startsWith(".list.") || s.startsWith(".list:") || s.startsWith(".list>")) {
    return true;
  }
  return /^\.list\s/.test(s);
}

test("the list stylesheet ships in the sailcloth bundle", () => {
  assert.ok(source.length > 0, "styles/src/list.css is empty");
  assert.match(ui, /@import "\.\/list\.css";|\.list \.list-intro/, "ui.css does not import the list sheet");
});

test("every list rule stays under the list article root", () => {
  const unscoped = blocks(source)
    .filter((block) => !block.selector.startsWith("@"))
    .flatMap((block) => selectors(block.selector))
    .filter((selector) => selector !== "" && !rooted(selector));
  assert.deepEqual(unscoped, [], "a list rule reaches outside `<article class=\"list\">`");
});

test("the list stylesheet styles each view the layout renders", () => {
  const named = blocks(source)
    .filter((block) => !block.selector.startsWith("@"))
    .flatMap((block) => selectors(block.selector))
    .join("\n");
  for (const part of [
    ".list-intro",
    ".list-summary",
    ".list-count",
    ".list-records",
    ".list-group",
    ".list-group-count",
    ".list-group-summary",
    ".dated-list",
    ".dated-list-item",
    ".dated-list-day",
    ".dated-list-link",
    ".changes-record",
    ".changes-field",
    ".blog-item",
    ".blog-item-title",
    ".blog-meta",
    ".blog-description",
    ".list-feed",
    ".list-subscribe",
    ".pagination",
    ".pagination-link",
  ]) {
    assert.ok(named.includes(part), `the list stylesheet does not name ${part}`);
  }
});

test("a link and a focus ring stay visible on the list page", () => {
  const text = source.replace(/\/\*[\s\S]*?\*\//g, "");
  assert.match(text, /\.list[^{]*\ba\b[^{]*\{[^}]*color:\s*var\(--color-link\)/s, "a list link does not take the link token");
  assert.match(text, /:focus-visible/, "no focus-visible rule on a list control");
  assert.match(text, /\.dated-list-day\s*\{[^}]*flex:\s*0 0 5rem/s, "the dated view does not give its day a column");
});
