import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { labelable, stampLabels, type SourceBlock } from "../chrome/source-mode/client.ts";

function blocks(html: string, dir: "ltr" | "rtl" = "ltr") {
  const dom = new JSDOM(`<!doctype html><html dir="${dir}"><body><main class="doc-body">${html}</main></body></html>`);
  const document = dom.window.document;
  const list = [...document.querySelectorAll("[data-src]")] as unknown as SourceBlock[];
  return { document, list };
}

test("every top-level block gets a file:line label after its text, in either direction", () => {
  for (const dir of ["ltr", "rtl"] as const) {
    const { document, list } = blocks(
      `<p data-src="docs/a.md:3:1-3:20">Hello</p><section data-src="docs/a.md:5:1-9:1"><p data-src="docs/a.md:6:1-6:4">in</p></section>`,
      dir,
    );
    const count = stampLabels({ blocks: list, createLabel: () => document.createElement("span") as never });
    assert.equal(count, 2, "the nested block is left to its outer block");
    const labels = [...document.querySelectorAll("[data-source-label]")];
    assert.deepEqual(labels.map((l) => l.textContent), ["docs/a.md:3", "docs/a.md:5"]);
    assert.equal(document.querySelector("p")?.lastElementChild, labels[0], "the label follows the block's text");
    assert.equal(labels[0]?.getAttribute("dir"), "ltr", `a path reads left to right in ${dir}`);
  }
});

test("blocks without a valid span, and list or table blocks, get no label", () => {
  const { list } = blocks(
    `<p data-src="nonsense">x</p><ul data-src="a.md:1:1-2:1"><li>a</li></ul><table data-src="a.md:4:1-6:1"></table><p data-src="a.md:8:1-8:5">ok</p>`,
  );
  assert.equal(labelable(list).length, 1);
});

test("the stylesheet places labels with logical properties and no flow, so nothing shifts", () => {
  const css = readFileSync(new URL("../chrome/source-mode/style.css", import.meta.url), "utf8");
  assert.match(css, /\.source-label \{\s*display: none;/, "labels are not rendered until the mode is on");
  assert.match(css, /\.source-mode \.source-label \{[^}]*position: absolute;/);
  assert.match(css, /inset-inline-end: calc\(100% \+ var\(--space-3\)\)/, "start margin on wide screens");
  assert.match(css, /inset-block-end: 100%/, "above the block on narrow screens");
  assert.doesNotMatch(css, /\b(left|right|margin-left|margin-right):/);
});
