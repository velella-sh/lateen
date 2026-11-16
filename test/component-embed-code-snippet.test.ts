import assert from "node:assert/strict";
import { test } from "node:test";
import type { ComponentProps } from "@velella/mizzen/contracts";
import embedCode, { type EmbedCodeProps } from "../components/embed-code/index.ts";
import { htmlSnippet, markdownSnippet } from "../components/embed-code/snippet.ts";
import { html, pageWith, siteWith } from "./helpers-embed.ts";

const info = { title: 'Guide <b> & "more"', facts: ["Fast", "Uses <script>alert(1)</script>"], href: "https://example.com/guide/" };

test("the HTML snippet has the title, the facts as text and a link, and no script or style", () => {
  const out = htmlSnippet(info);
  assert.match(out, /<h2>Guide &lt;b&gt; &amp; &quot;more&quot;<\/h2>/);
  assert.match(out, /<li>Fast<\/li>/);
  assert.match(out, /<a href="https:\/\/example\.com\/guide\/">/);
  assert.doesNotMatch(out, /<script|style=/i);
});

test("the Markdown snippet carries the same and escapes markup characters", () => {
  const out = markdownSnippet({ ...info, title: "A *b* [c]" });
  assert.match(out, /^## A \\\*b\\\* \\\[c\\\]/);
  assert.match(out, /- Fast/);
  assert.match(out, /\]\(https:\/\/example\.com\/guide\/\)$/);
});

test("a copy with no facts has no list", () => {
  assert.doesNotMatch(htmlSnippet({ ...info, facts: [] }), /<ul>/);
});

test("the component shows three tabs' panels and says the copies do not update", () => {
  const target = pageWith({ url: "/embed/g/", frontMatter: { description: "Short.", embedded: { of: "/g/" } } });
  const page = pageWith({ url: "/docs/" });
  const out = html(embedCode({ props: { src: "/embed/g/" }, site: siteWith([page, target], { url: "https://example.com" }), page, html: "" } as unknown as ComponentProps<EmbedCodeProps>));
  assert.match(out, /data-embed-panel="frame"/);
  assert.match(out, /data-embed-panel="html"/);
  assert.match(out, /data-embed-panel="markdown"/);
  assert.match(out, /do not update by themselves/);
  assert.match(out, /Short\./);
  assert.doesNotMatch(out.replace(/&lt;script/g, ""), /<script/);
});
