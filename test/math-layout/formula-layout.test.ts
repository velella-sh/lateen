// Formula styles and markup: the same MathML has to read in light and dark, at a narrow width,
// and inside right-to-left prose. The styles are checked as CSS because a narrow viewport is a
// layout rule, and the markup is checked from a build of `fixtures/math/` because the engine owns
// the MathML tree.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { all, attrs, build, textOf } from "../integration-helpers.ts";

const css = readFileSync(new URL("../../styles/math.css", import.meta.url), "utf8");
const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");

const fixture = build("math");
const page = fixture.document("/");
const rtlPage = fixture.document("/fa/");

test("a block formula stays inside a narrow column and scrolls sideways", () => {
  const block = /math\[display="block"\]\s*\{([^}]*)\}/.exec(withoutComments);
  assert.ok(block, "styles/math.css has no math[display=\"block\"] rule");
  const body = block[1] ?? "";
  assert.match(body, /max-inline-size:\s*100%/);
  assert.match(body, /overflow-x:\s*auto/);
  assert.doesNotMatch(body, /min-inline-size|min-width|width:\s*\d/);
});

test("a formula inherits the page colour, so both themes and forced colors apply", () => {
  const base = /(?:^|\n)math\s*\{([^}]*)\}/.exec(withoutComments);
  assert.ok(base, "styles/math.css has no math rule");
  assert.match(base[1] ?? "", /color:\s*inherit/);
  assert.doesNotMatch(withoutComments, /background(?:-color)?\s*:/, "the formula paints no surface of its own");
});

test("formula styles use logical properties and design tokens only", () => {
  assert.doesNotMatch(withoutComments, /\b(?:margin|padding|border|inset)-(?:left|right|top|bottom)\b/);
  assert.doesNotMatch(withoutComments, /\btext-align:\s*(?:left|right)\b/);
  assert.doesNotMatch(withoutComments, /#[0-9a-f]{3,8}\b|\b(?:rgb|hsl|oklch|lab)\(/i);
  const tokens = readFileSync(new URL("../../styles/tokens.css", import.meta.url), "utf8");
  const defined = new Set([...tokens.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((match) => match[1] ?? ""));
  for (const token of withoutComments.matchAll(/var\(\s*(--[a-z0-9-]+)/g)) {
    assert.ok(defined.has(token[1] ?? ""), `styles/math.css reads ${token[1]}, which tokens.css does not define`);
  }
});

test("nothing in the styles hides a formula or its annotation from assistive technology", () => {
  assert.doesNotMatch(withoutComments, /(?:^|\})\s*(?:math|annotation|semantics|mrow)\b[^{]*\{[^}]*(?:display:\s*none|visibility:\s*hidden)/);
  assert.doesNotMatch(withoutComments, /aria-hidden/);
});

test("inline and block formulas carry their display, direction, and TeX text", () => {
  assert.equal(all(page, "math[display=\"inline\"]").length, 2);
  assert.equal(all(page, "math[display=\"block\"]").length, 1);
  assert.deepEqual(attrs(page, "math", "dir"), ["ltr", "ltr", "ltr"]);
  assert.deepEqual(attrs(page, 'math[display="inline"]', "alttext"), ["a^2", "\\frac{a}{b}"]);

  const block = page.querySelector('math[display="block"]');
  assert.equal(block?.getAttribute("alttext"), "\\frac{a}{b} = c");
  assert.equal(textOf(block?.querySelector('annotation[encoding="application/x-tex"]')), "\\frac{a}{b} = c");
  assert.ok(block?.querySelector("semantics > mrow"), "the MathML tree is the semantics body");
  assert.equal(block?.getAttribute("aria-hidden"), null);
});

test("right-to-left prose keeps formulas left to right and isolated", () => {
  assert.equal(rtlPage.documentElement.getAttribute("dir"), "rtl");
  assert.equal(all(rtlPage, "math").length, 3);
  assert.deepEqual(attrs(rtlPage, "math", "dir"), ["ltr", "ltr", "ltr"]);
  assert.match(withoutComments, /unicode-bidi:\s*isolate/);
});

test("the built page loads the formula stylesheet", () => {
  const hrefs = all(page, 'link[rel="stylesheet"]').map((link) => link.getAttribute("href") ?? "");
  const bundled = hrefs.map((href) => fixture.file(href.replace(/^\//, ""))).join("\n");
  assert.match(bundled, /math\[display=.{0,2}block/);
  assert.match(bundled, /overflow-x:\s*auto/);
});
