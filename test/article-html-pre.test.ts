import assert from "node:assert/strict";
import { test } from "node:test";
import { articleHtml } from "../src/article-html.ts";

test("a plain code fence becomes keyboard focusable and a focusable one is left alone", () => {
  assert.equal(articleHtml('<pre data-src="a.md:1:1-3:3"><code>x</code></pre>'), '<pre data-src="a.md:1:1-3:3" tabindex="0"><code>x</code></pre>');
  assert.equal(articleHtml('<pre class="code" tabindex="0"><code>x</code></pre>'), '<pre class="code" tabindex="0"><code>x</code></pre>');
  assert.equal(articleHtml("<p>no code</p>"), "<p>no code</p>");
});
