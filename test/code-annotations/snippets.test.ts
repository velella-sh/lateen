import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { highlightFences } from "../../components/code/index.ts";
import { attrs, build } from "../integration-helpers.ts";

test("external Markdown range includes label the real code lines and keep annotations relative to the fence", () => {
  const site = build("integration", process.env, {
    "snippet.md": `---
title: Snippet
layout: doc
---

::include[_snippets/demo.md]{lines=3-7}

\`\`\`ts showLineNumbers
const inline = true;
\`\`\`
`,
    "_snippets/demo.md": `Unincluded intro.

\`\`\`ts showLineNumbers {2} annotations={2: The second code line}
const first = 1;
const second = 2;
const third = 3;
\`\`\`
`,
  });
  const document = site.document("/snippet/");
  const snippet = document.querySelector('pre[data-src^="_snippets/demo.md:"]');
  assert.ok(snippet);
  assert.equal(snippet.getAttribute("data-src"), "_snippets/demo.md:3:1-7:3");
  assert.deepEqual(attrs(snippet, ".line", "data-line"), ["4", "5", "6"]);
  assert.equal(snippet.querySelector(".highlighted")?.getAttribute("data-line"), "5");
  assert.equal(snippet.querySelector(".line-link")?.getAttribute("href"), `#${snippet.id}-L4`);
  const note = document.querySelector(".code-annotations-link");
  assert.equal(note?.textContent, "Line 5");
  assert.ok(document.getElementById(`${snippet.id}-line-5`));
  assert.equal(note?.getAttribute("href"), `#${snippet.id}-line-5`);
  assert.deepEqual(attrs(document, 'pre[data-src^="snippet.md:"] .line', "data-line"), ["1"]);
});

test("raw source ranges use their first data-src line without a Markdown fence offset", () => {
  // This is the markup produced by the engine's renderSnippet helper, which the CLI does not call.
  const html = '<pre data-src="example.ts:7:1-8:14"><code class="language-ts">const a = 1;\nconst b = 2;\n</code></pre>';
  const fragment = JSDOM.fragment(highlightFences(html, undefined, "en", "snippet.md"));
  assert.deepEqual(attrs(fragment, ".line", "data-line"), ["7", "8"]);
  assert.deepEqual(attrs(fragment, ".line-link", "href"), ["#code-example-ts-7-1-8-14-L7", "#code-example-ts-7-1-8-14-L8"]);
});
