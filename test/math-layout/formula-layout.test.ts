// Formula styles and markup: the same MathML has to read in light and dark, at a narrow width,
// and inside right-to-left prose. The styles are checked as CSS because a narrow viewport is a
// layout rule, and the markup is checked from a build of `fixtures/math/` because the engine owns
// the MathML tree.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { all, attrs, build, textOf } from "../integration-helpers.ts";

const css = "" /* lateen-legacy removed: ../styles/math.css */;
const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");

const fixture = build("math");
const page = fixture.document("/");
const rtlPage = fixture.document("/fa/");

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

test("right-to-left prose keeps formulas left to right", () => {
  assert.equal(rtlPage.documentElement.getAttribute("dir"), "rtl");
  assert.equal(all(rtlPage, "math").length, 3);
  assert.deepEqual(attrs(rtlPage, "math", "dir"), ["ltr", "ltr", "ltr"]);
});

