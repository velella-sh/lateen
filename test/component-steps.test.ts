import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import steps, { digitsOf, directive, stepsOf } from "../components/steps/index.ts";

const root = fileURLToPath(new URL("../", import.meta.url));
const stylePath = join(root, "components/steps/style.css");
const namesPath = join(root, "tokens/names.json");

type RenderedNode = {
  props: { class: string; dangerouslySetInnerHTML: { __html: string } };
};

const ORDERED_LIST = "<ol><li><p>Install.</p></li><li><p>Configure.</p><pre><code>run</code></pre><ol><li>nested</li></ol></li><li><p>Done.</p></li></ol>";

function render(html: string, lang = "en"): RenderedNode {
  return steps({ html, page: { lang } } as unknown as Parameters<typeof steps>[0]) as RenderedNode;
}

test("the directive is named steps", () => {
  assert.equal(directive, "steps");
});

test("wraps the list in .steps and numbers three steps as text with stable anchors", () => {
  const node = render(ORDERED_LIST);
  assert.equal(node.props.class, "steps");
  const html = node.props.dangerouslySetInnerHTML.__html;
  for (const n of [1, 2, 3]) {
    assert.ok(html.includes(`<li id="step-${n}" class="step" data-step="${n}"><span class="step-number">Step ${n}</span>`));
  }
  assert.doesNotMatch(html, /step-4/);
});

test("nested content stays inside its step and nested lists are not numbered", () => {
  const html = render(ORDERED_LIST).props.dangerouslySetInnerHTML.__html;
  assert.ok(html.includes("<pre><code>run</code></pre><ol><li>nested</li></ol>"));
  assert.deepEqual(stepsOf(ORDERED_LIST), [
    { number: 1, id: "step-1", title: "Install." },
    { number: 2, id: "step-2", title: "Configure." },
    { number: 3, id: "step-3", title: "Done." },
  ]);
});

test("Persian and Arabic pages number with their own digits", () => {
  assert.equal(digitsOf(12, "fa"), "۱۲");
  assert.equal(digitsOf(12, "ar-EG"), "١٢");
  assert.equal(digitsOf(12, "en"), "12");
  assert.match(render(ORDERED_LIST, "fa").props.dangerouslySetInnerHTML.__html, /<span class="step-number">گام ۲<\/span>/);
  assert.match(render(ORDERED_LIST, "ar").props.dangerouslySetInnerHTML.__html, /الخطوة ٣/);
});

test("a list without items is passed through", () => {
  assert.equal(render("<p>None</p>").props.dangerouslySetInnerHTML.__html, "<p>None</p>");
});

test("style.css uses only token custom properties from names.json", () => {
  const names = JSON.parse(readFileSync(namesPath, "utf8")) as Record<string, Record<string, unknown>>;
  const allowed = new Set<string>();
  for (const [group, entries] of Object.entries(names)) {
    for (const key of Object.keys(entries)) allowed.add(`--${group}-${key}`);
  }

  const css = readFileSync(stylePath, "utf8");
  const used = [...css.matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1]!);
  assert.ok(used.length > 0, "expected token var() references");
  const unknown = [...new Set(used)].filter((name) => !allowed.has(name));
  assert.deepEqual(unknown, []);
});

test("style.css styles the number as text, not as a CSS counter", () => {
  const css = readFileSync(stylePath, "utf8");
  assert.match(css, /\.step-number\s*\{/);
  assert.doesNotMatch(css, /counter-increment|counter\(/);
});

test("style.css uses logical properties only, so right-to-left pages lay out correctly", () => {
  const css = readFileSync(stylePath, "utf8");
  const physical = /\b(margin|padding|border|inset)-(left|right)\b|\b(left|right):\s/;
  assert.doesNotMatch(css, physical);
});
