// Equations in both outputs: the HTML a reader gets and the Markdown twin an agent gets. The same
// fixture is built twice and compared byte for byte, and every form the epic names -- inline,
// block, an escaped dollar, a code span, and a broken formula -- has its own expectation.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { all, attrs, build, textOf } from "../integration-helpers.ts";

const first = build("math");
const second = build("math");
const broken = build("math-broken");

test("two builds of the same sample write identical HTML and Markdown", () => {
  for (const path of ["/", "/fa/", "/index.md", "/fa/index.md"]) {
    assert.equal(first.html(path), second.html(path), `${path} changed between builds`);
  }
});

test("inline formulas are inline MathML with the TeX as alt text and annotation", () => {
  const doc = first.document("/");
  const inline = all(doc, 'math[display="inline"]');
  assert.equal(inline.length, 2);
  assert.deepEqual(attrs(doc, 'math[display="inline"]', "alttext"), ["a^2", "\\frac{a}{b}"]);
  assert.deepEqual(attrs(doc, 'math[display="inline"]', "dir"), ["ltr", "ltr"]);
  assert.deepEqual(
    inline.map((math) => textOf(math.querySelector('annotation[encoding="application/x-tex"]'))),
    ["a^2", "\\frac{a}{b}"],
  );
});

test("a block formula is one block MathML node with the whole TeX", () => {
  const doc = first.document("/");
  const block = doc.querySelector('math[display="block"]');
  assert.ok(block, "the block formula did not render as MathML");
  assert.equal(all(doc, 'math[display="block"]').length, 1);
  assert.equal(block.getAttribute("alttext"), "\\frac{a}{b} = c");
  assert.equal(block.getAttribute("dir"), "ltr");
  assert.equal(textOf(block.querySelector('annotation[encoding="application/x-tex"]')), "\\frac{a}{b} = c");
  assert.ok(block.querySelector("semantics > mrow > mfrac"), "the block keeps its MathML tree");
});

test("a plain dollar and a dollar in a code span are never math", () => {
  const doc = first.document("/");
  const body = doc.querySelector(".doc-body");
  assert.ok(body, "the article is missing");
  assert.ok(textOf(body).includes("A literal dollar costs $5"), "the escaped dollar is not literal text");
  assert.ok(all(body, "code").some((code) => textOf(code) === "$a^2$"), "the code span is not code");
  assert.equal(all(body, "math").length, 3, "a dollar outside the three formulas became math");
});

test("the Markdown twin keeps the original form unchanged", () => {
  const twin = first.file("index.md");
  assert.ok(twin.includes("The area is $a^2$ and the ratio is $\\frac{a}{b}$."));
  assert.ok(twin.includes("$$\n\\frac{a}{b} = c\n$$"));
  assert.ok(twin.includes("A literal dollar costs \\$5, and `$a^2$` in a code span stays text."));
  assert.ok(!twin.includes("<math"), "the twin must not carry rendered HTML");
});

test("the right-to-left twin keeps the same formulas", () => {
  const twin = first.file("fa/index.md");
  assert.ok(twin.includes("مساحت $a^2$ و نسبت $\\frac{a}{b}$ است."));
  assert.ok(twin.includes("$$\n\\frac{a}{b} = c\n$$"));
});

// shortcut: engine 0.2.3 computes math diagnostics but `build` and `check` do not print them yet;
// this pins the literal fallback and the source span the diagnostic points at. Upgrade when
// @velella/mizzen surfaces mathDiagnostics in its check output.
test("a broken formula stays literal at its source position", () => {
  const doc = broken.document("/");
  assert.equal(all(doc, "math").length, 0, "a broken formula must not become MathML");

  const body = doc.querySelector(".doc-body");
  assert.ok(body, "the article is missing");
  const paragraphs = all(body, "p");

  const empty = paragraphs.find((p) => textOf(p).startsWith("An empty pair:"));
  assert.ok(empty);
  assert.equal(textOf(empty), "An empty pair: $$ $$.");

  const unclosed = paragraphs.find((p) => textOf(p).startsWith("$$ a + b"));
  assert.ok(unclosed, "the unclosed block is not kept as text");
  assert.equal(unclosed.getAttribute("data-src"), "index.md:9:1-10:5");

  const unsupported = paragraphs.find((p) => textOf(p).startsWith("An unsupported command:"));
  assert.ok(unsupported);
  assert.ok(
    textOf(unsupported).includes("$\\unknown{a}$"),
    "the unsupported command is not kept as literal text",
  );
  assert.equal(unsupported.getAttribute("data-src"), "index.md:12:1-12:38");
});

test("the broken page keeps its Markdown source too", () => {
  const source = readFileSync(new URL("../../fixtures/math-broken/index.md", import.meta.url), "utf8");
  assert.ok(broken.file("index.md").includes("An unsupported command: $\\unknown{a}$."));
  assert.ok(source.includes("$$ $$"), "the fixture gained or lost the empty pair");
});
