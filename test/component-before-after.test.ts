import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { renderToString } from "preact-render-to-string";
import beforeAfter, { blocksOf, lineSet } from "../components/before-after/index.ts";
import { copy, wire, type CopyButton } from "../components/before-after/copy.ts";

const HTML =
  '<pre><code class="language-js">const a = 1;\nconst b = &lt;x&gt;;\n</code></pre><pre><code class="language-js">const a = 2;\nconst c = 3;\n</code></pre>';
const render = (props = {}, lang = "en", html = HTML): string =>
  renderToString(beforeAfter({ props, html, page: { lang } } as never) as never);

test("renders Before and After panes with their labels and code", () => {
  const html = render();
  assert.match(html, /ba-pane ba-before/);
  assert.match(html, /ba-pane ba-after/);
  assert.match(html, /<span class="ba-label">Before<\/span>/);
  assert.match(html, /<span class="ba-label">After<\/span>/);
  assert.match(html, /const b = &lt;x>;/);
  assert.match(render({}, "fa"), /قبل/);
});

test("lines are marked with a sign and a style, not by colour alone", () => {
  const html = render({ removed: "2", added: "1-2" });
  assert.equal(html.match(/ba-removed/g)?.length, 1);
  assert.equal(html.match(/ba-added/g)?.length, 2);
  assert.match(html, /<span class="ba-sign">−<\/span>/);
  assert.match(html, /<span class="ba-sign">\+<\/span>/);
  assert.deepEqual([...lineSet("1, 3-4, x")], [1, 3, 4]);
});

test("each block has its own copy button holding the plain code, without signs", () => {
  const html = render({ removed: "1" });
  assert.equal(html.match(/data-before-after-copy/g)?.length, 2);
  assert.match(html, /data-text="const a = 1;\nconst b = &lt;x>;"/);
  assert.deepEqual(blocksOf(HTML).map((b) => b.lang), ["js", "js"]);
});

test("copy buttons stay hidden without a clipboard and copy with one", async () => {
  const hidden = render();
  assert.match(hidden, /class="ba-copy" hidden/);

  const written: string[] = [];
  const timers: (() => void)[] = [];
  const button: CopyButton & { click?: () => void } = {
    hidden: true,
    textContent: "Copy",
    dataset: { text: "x", copied: "Copied" },
    addEventListener: (_t, l) => {
      button.click = l;
    },
  };
  wire([button], { clipboard: undefined, schedule: () => 0 });
  assert.equal(button.hidden, true);
  const env = { clipboard: { writeText: async (t: string) => void written.push(t) }, schedule: (cb: () => void) => void timers.push(cb) };
  wire([button], env);
  assert.equal(button.hidden, false);
  await copy(button, env);
  assert.deepEqual(written, ["x"]);
  assert.equal(button.textContent, "Copied");
  timers[0]?.();
  assert.equal(button.textContent, "Copy");
});

test("without two code blocks the body is kept as written", () => {
  assert.match(render({}, "en", "<p>No code</p>"), /<p>No code<\/p>/);
});
