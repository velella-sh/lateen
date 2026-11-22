// The right-column "On this page" list is the reader's position marker: depth, spacing, and the
// active section must read at a glance. These checks lock the sailcloth rules that carry that job
// and keep them scoped to the sticky column, so the mobile fold and the left sidebar do not change.
import assert from "node:assert/strict";
import { test } from "node:test";
import { readUiCss } from "./ui-css-helpers.ts";

const source = readUiCss().replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " "));

/** The declarations of every rule whose selector list contains `selector`, joined. */
function bodyOf(selector: string): string {
  const exact = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return [...source.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter((match) => (match[1] ?? "").split(",").some((part) => part.trim() === selector))
    .map((match) => match[2] ?? "")
    .join("\n");
}

const declarations = (body: string): Map<string, string> => {
  const found = new Map<string, string>();
  for (const match of body.matchAll(/([-\w]+)\s*:\s*([^;]+)/g)) found.set(match[1] ?? "", (match[2] ?? "").trim());
  return found;
};

test("a nested section steps down a size and sits on its own rail", () => {
  const nested = declarations(bodyOf(".toc ul ul"));
  assert.equal(nested.get("border-inline-start"), "1px solid var(--border)", "the nested list has its own rail");
  assert.match(nested.get("margin-inline-start") ?? "", /var\(--space-3\)/, "the nested list steps in");
  assert.equal(nested.get("padding-inline-start"), "0", "the rail is the indent; no extra padding");

  const nestedLink = declarations(bodyOf(".toc ul ul a"));
  assert.equal(nestedLink.get("font-size"), "0.8125rem", "a subsection is one size below its parent");
  assert.equal(nestedLink.get("font-weight"), "400", "a subsection link is not bold until it is active");
});

test("top-level entries breathe more than nested ones, and both read as one list", () => {
  const top = declarations(bodyOf(".toc ul"));
  const nested = declarations(bodyOf(".toc ul ul"));
  const rem = (value: string | undefined): number => Number.parseFloat(value ?? "NaN");

  assert.ok(rem(top.get("row-gap")) > 0, "top-level rows have a gap");
  assert.ok(
    rem(top.get("row-gap")) > rem(nested.get("row-gap")),
    "the top level is roomier than the nested list, so depth reads in the spacing",
  );

  const topLink = declarations(bodyOf(".toc a"));
  const nestedLink = declarations(bodyOf(".toc ul ul a"));
  assert.ok(
    rem(topLink.get("padding-block")) > rem(nestedLink.get("padding-block")),
    "a parent link has a taller target than its child",
  );
});

test("the active section is a filled marker with a heavier weight, not colour alone", () => {
  const active = declarations(bodyOf('.toc a[aria-current="true"]'));
  assert.equal(active.get("border-inline-start-color"), "var(--link)", "the current section keeps the rail on the link colour");
  assert.match(active.get("background") ?? "", /var\(--link\)/, "the current section has a tinted fill");
  assert.equal(active.get("color"), "var(--foreground)");
  assert.equal(active.get("font-weight"), "700");

  const activeNested = declarations(bodyOf('.toc ul ul a[aria-current="true"]'));
  assert.equal(activeNested.get("font-weight"), "600", "a current subsection is bolder than its siblings");
});

test("the column scrolls on its own and every rule stays inside the sticky aside", () => {
  const toc = declarations(bodyOf(".toc"));
  assert.match(toc.get("max-block-size") ?? "", /dvh/, "the column is capped to the viewport height");
  assert.equal(toc.get("overflow"), "auto", "a list taller than the column scrolls in place");

  for (const selector of [".toc ul", ".toc a", ".toc ul ul", ".toc ul ul a", '.toc a[aria-current="true"]']) {
    assert.ok(selector.startsWith(".toc"), `${selector} is scoped to the sticky column`);
  }
});

test("the mobile fold keeps the shared rules, without the column-only spacing", () => {
  assert.equal(bodyOf(".toc-fold ul ul"), "", "the fold does not pick up the column's nested rail");
  assert.match(bodyOf(".toc a"), /font-size/, "only the aside list gets the column link recipe");
});
