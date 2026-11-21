import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import steps, { digitsOf, directive, stepsOf } from "../components/steps/index.ts";

const root = fileURLToPath(new URL("../", import.meta.url));
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

test("wraps the list in .steps and numbers three steps as text with title anchors", () => {
  const node = render(ORDERED_LIST);
  assert.equal(node.props.class, "steps");
  const html = node.props.dangerouslySetInnerHTML.__html;
  const anchors = ["install", "configure", "done"];
  anchors.forEach((anchor, index) => {
    const n = index + 1;
    assert.ok(html.includes(`<li id="step-${anchor}" class="step" data-step="${n}"><span class="step-number">Step ${n}</span>`));
  });
  assert.doesNotMatch(html, /step-4/);
});

test("nested content stays inside its step and nested lists are not numbered", () => {
  const html = render(ORDERED_LIST).props.dangerouslySetInnerHTML.__html;
  assert.ok(html.includes('<div class="step-content"><p>Configure.</p><pre><code>run</code></pre><ol><li>nested</li></ol></div>'));
  assert.deepEqual(stepsOf(ORDERED_LIST), [
    { number: 1, id: "step-install", title: "Install." },
    { number: 2, id: "step-configure", title: "Configure." },
    { number: 3, id: "step-done", title: "Done." },
  ]);
});

test("inserting a step keeps the anchors of the steps around it", () => {
  const before = stepsOf(ORDERED_LIST).map((step) => step.id);
  const inserted = "<ol><li><p>Check the version.</p></li><li><p>Install.</p></li><li><p>Configure.</p></li><li><p>Done.</p></li></ol>";
  assert.deepEqual(stepsOf(inserted).slice(1).map((step) => step.id), before);
});

test("repeated titles get one anchor each and empty titles fall back to their number", () => {
  const html = "<ol><li><p>Install.</p></li><li><p>Install.</p></li><li><pre><code>run</code></pre></li></ol>";
  assert.deepEqual(stepsOf(html), [
    { number: 1, id: "step-install", title: "Install." },
    { number: 2, id: "step-install-2", title: "Install." },
    { number: 3, id: "step-3", title: "" },
  ]);
});

test("Persian and Arabic pages number with their own digits", () => {
  assert.equal(digitsOf(12, "fa"), "۱۲");
  assert.equal(digitsOf(12, "ar-EG"), "١٢");
  assert.equal(digitsOf(12, "en"), "12");
  assert.match(render(ORDERED_LIST, "fa").props.dangerouslySetInnerHTML.__html, /<span class="step-number">گام ۲<\/span>/);
  assert.match(render(ORDERED_LIST, "ar").props.dangerouslySetInnerHTML.__html, /الخطوة ٣/);
});

test("a step can end with two linked next paths, kept in order without an island", () => {
  const paths = '<ul><li><a href="/install/">Install the theme</a></li><li><a href="/add-component/">Add a component</a></li></ul>';
  const list = `<ol><li><p>Install the package.</p></li><li><p>Choose a next path.</p>${paths}</li></ol>`;
  const node = render(list);
  const html = node.props.dangerouslySetInnerHTML.__html;
  assert.ok(html.includes(paths), "both links stay in the step");
  assert.ok(html.indexOf('href="/install/"') < html.indexOf('href="/add-component/"'), "the links keep their order");
  assert.equal(stepsOf(list)[1]?.title, "Choose a next path.", "the title stops before the link list");
  assert.doesNotMatch(html, /<script/, "the links need no island");
});

test("a list without items is passed through", () => {
  assert.equal(render("<p>None</p>").props.dangerouslySetInnerHTML.__html, "<p>None</p>");
});

