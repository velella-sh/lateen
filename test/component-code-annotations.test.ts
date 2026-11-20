import assert from "node:assert/strict";
import { test } from "node:test";
import { highlightFences } from "../components/code/index.ts";

/** `data-code` as rehype writes it: the JSON's quotes and ampersands escaped for the attribute. */
function dataCode(meta: Record<string, unknown>): string {
  return JSON.stringify({
    raw: "",
    title: null,
    highlight: [],
    ins: [],
    del: [],
    diff: false,
    showLineNumbers: false,
    annotations: [],
    ...meta,
  })
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&#x22;");
}

function fence(code: string, meta: string | undefined, lang = "ts"): string {
  const attributes = meta === undefined ? "" : ` data-code="${meta}"`;
  return `<pre data-src="a.md:3"${attributes}><code class="language-${lang}">${code}</code></pre>`;
}

/** The HTML of the block itself, without the title bar, the notes after it, or the meta attribute. */
function preOf(html: string): string {
  return (/<pre[\s\S]*?<\/pre>/.exec(html)?.[0] ?? "").replace(/\sdata-code="[^"]*"/, "");
}

test("a full block gets a title bar, highlighted numbered lines, and readable notes after the pre", () => {
  const meta = dataCode({
    title: "src/a.ts",
    highlight: [{ from: 2, to: 2 }],
    showLineNumbers: true,
    annotations: [
      { from: 1, to: 1, text: 'Single <note> & "quote"' },
      { from: 2, to: 3, text: "Range note" },
    ],
  });
  const out = highlightFences(fence("const a = 1;\nconst b = 2;\nconst c = 3;\n", meta));
  assert.match(out, /^<div class="code-title">.*<span class="code-title-name">src\/a\.ts<\/span><\/div><pre /);
  assert.match(out, /class="line" id="code-a-md-3-L1" data-line="1"><a class="line-link" href="#code-a-md-3-L1"[^>]*><\/a><span id="code-a-md-3-line-1"><\/span>/);
  assert.match(out, /class="line highlighted" id="code-a-md-3-L2" data-line="2"><a class="line-link" href="#code-a-md-3-L2"[^>]*><\/a><span id="code-a-md-3-line-2"><\/span>/);
  assert.match(out, /class="line" id="code-a-md-3-L3" data-line="3"><a class="line-link" href="#code-a-md-3-L3"[^>]*><\/a><span id="code-a-md-3-line-3"><\/span>/);
  assert.match(out, /<\/pre><details class="code-annotations">/);
  assert.match(out, /<summary class="code-annotations-summary">Annotations \(2\)<\/summary>/);
  assert.match(
    out,
    /<a class="code-annotations-link" href="#code-a-md-3-line-1">Line 1<\/a> <span class="code-annotations-text">Single &lt;note> &amp; &quot;quote&quot;<\/span>/,
  );
  assert.match(out, /<a class="code-annotations-link" href="#code-a-md-3-line-2">Lines 2–3<\/a>/);
});

test("a minimal block keeps its plain fence markup and adds no notes", () => {
  const out = highlightFences(fence("const a = 1;\n", dataCode({})));
  assert.match(out, /^<pre class="code" tabindex="0" id="code-a-md-3" data-lang="ts" data-src="a.md:3"/);
  assert.doesNotMatch(out, /code-title|code-annotations|data-line|highlighted/);
  assert.match(out, /<span class="line" id="code-a-md-3-L1">/);
});

test("a range note names the range, links its first line, and ids every covered line", () => {
  const out = highlightFences(
    fence("a\nb\nc\n", dataCode({ annotations: [{ from: 2, to: 3, text: "Both lines" }] })),
  );
  assert.match(out, /href="#code-a-md-3-line-2">Lines 2–3<\/a>/);
  assert.match(out, /class="line" id="code-a-md-3-L2"><a class="line-link"[^>]*><\/a><span id="code-a-md-3-line-2"><\/span>/);
  assert.match(out, /class="line" id="code-a-md-3-L3"><a class="line-link"[^>]*><\/a><span id="code-a-md-3-line-3"><\/span>/);
  assert.doesNotMatch(out, /code-a-md-3-line-1/);
  assert.match(out, /<span class="code-annotations-text">Both lines<\/span>/);
});

test("a block with no annotations renders no disclosure and no line ids", () => {
  const out = highlightFences(fence("a\n", dataCode({ title: "a.ts" })));
  assert.match(out, /code-title/);
  assert.doesNotMatch(out, /code-annotations|-line-\d/);
});

test("malformed JSON and unusable annotation entries are ignored", () => {
  const broken = highlightFences(fence("a\n", "not json"));
  assert.match(broken, /<pre class="code"/);
  assert.doesNotMatch(broken, /code-annotations|-line-\d/);

  const meta = dataCode({
    annotations: [
      { from: 0, to: 1, text: "starts before the block" },
      { from: 3, to: 2, text: "descending" },
      { from: 2, to: 2, text: "   " },
      { from: 2, to: 2 },
      "junk",
    ],
  });
  const out = highlightFences(fence("a\nb\n", meta));
  assert.doesNotMatch(out, /code-annotations|-line-\d/);
});

test("annotation text and its line label are escaped, and never enter the code", () => {
  const meta = dataCode({
    title: '<img src=x onerror="alert(1)">',
    annotations: [{ from: 1, to: 1, text: '<script>alert("x")</script> & more' }],
  });
  const out = highlightFences(fence("const a = 1;\n", meta));
  // `data-code` carries the source text and is not markup; everywhere else the tags must be escaped.
  const rendered = out.replace(/\sdata-code="[^"]*"/, "");
  assert.doesNotMatch(rendered, /<script|<img/);
  assert.match(out, /<span class="code-title-name">&lt;img src=x onerror=&quot;alert\(1\)&quot;><\/span>/);
  assert.match(out, /<span class="code-annotations-text">&lt;script>alert\(&quot;x&quot;\)&lt;\/script> &amp; more<\/span>/);
  assert.doesNotMatch(preOf(out), /alert|more/);
});

test("the notes read without JavaScript: native details, summary, list, and links that resolve", () => {
  const out = highlightFences(
    fence("a\nb\n", dataCode({ annotations: [{ from: 2, to: 2, text: "Second line" }] })),
  );
  assert.doesNotMatch(out, /<script/);
  assert.match(out, /<details class="code-annotations"><summary class="code-annotations-summary">Annotations \(1\)<\/summary><ol class="code-annotations-list"><li class="code-annotations-item">/);
  const ids = new Set([...out.matchAll(/\sid="([^"]*)"/g)].map((match) => match[1]));
  const links = [...out.matchAll(/href="#([^"]*)"/g)].map((match) => match[1]!);
  assert.ok(links.includes("code-a-md-3-line-2"));
  for (const target of links) assert.ok(ids.has(target), target);
});

test("the summary follows the page language", () => {
  const meta = dataCode({ annotations: [{ from: 1, to: 1, text: "یادداشت" }] });
  const out = highlightFences(fence("a\n", meta), undefined, "fa");
  assert.match(out, /<summary class="code-annotations-summary">توضیحات \(1\)<\/summary>/);
  assert.match(out, />خط 1<\/a>/);
});
