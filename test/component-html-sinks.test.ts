import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToString } from "preact-render-to-string";
import type { VNode } from "preact";
import type { ComponentProps, Page } from "@velella/mizzen/contracts";
import fileTree, { labelHtml } from "../components/file-tree/index.ts";
import { codeTitle } from "../components/code/title.ts";
import linkCard from "../components/link-card/index.ts";

/** A page with nothing on it: these components only read the page for ids and the language. */
const page = { url: "/", title: "Page", lang: "en", dir: "ltr", html: "", markdown: "", headings: [], frontMatter: {}, kind: "doc" } as unknown as Page;
const site = { config: { base: "" } } as unknown as ComponentProps["site"];

function tree(body: string, props: Record<string, string> = {}): string {
  return renderToString(fileTree({ props, html: body, page, site } as unknown as ComponentProps<{ label?: string }>) as VNode);
}

test("a file-tree name or note cannot become markup", () => {
  const out = tree('<ul><li><img src=x onerror="alert(1)"> # <script>alert(1)</script></li></ul>');

  assert.doesNotMatch(out, /<img|<script/i);
  assert.match(out, /&lt;img src=x onerror=&quot;alert\(1\)&quot;>/);
  assert.match(out, /&lt;script>alert\(1\)&lt;\/script>/);
});

test("a file-tree label keeps the engine's inline formatting only", () => {
  const out = tree("<ul><li><strong>src/</strong> # <em>sources</em></li></ul>");
  assert.match(out, /<strong>src\/<\/strong>/);
  assert.match(out, /<em>sources<\/em>/);

  const hostile = tree("<ul><li><em onclick=\"alert(1)\">src/</em></li></ul>");
  assert.doesNotMatch(hostile, /<em onclick/i);
  assert.match(hostile, /&lt;em onclick=&quot;alert\(1\)&quot;>src\/<\/em>/);
});

test("labelHtml escapes stray tags and leaves text alone", () => {
  assert.equal(labelHtml("plain &amp; text"), "plain &amp; text");
  assert.equal(labelHtml("<span>x</span>"), "&lt;span>x&lt;/span>");
  assert.equal(labelHtml("a < b"), "a &lt; b");
});

test("a code title cannot become markup", () => {
  const out = renderToString(codeTitle('<img src=x onerror="alert(1)">')!);
  assert.doesNotMatch(out, /<img/i);
  assert.match(out, /&lt;img/);
});

test("an unsafe link-card URL renders nothing and a hostile title stays text", () => {
  const props = { href: "javascript:alert(1)", title: "<img src=x>" };
  assert.equal(linkCard({ props, html: "", page, site } as unknown as ComponentProps<typeof props>), null);

  const out = renderToString(
    linkCard({ props: { href: "/x", title: '<img src=x onerror="alert(1)">' }, html: "", page, site } as unknown as ComponentProps<typeof props>) as VNode,
  );
  assert.doesNotMatch(out, /<img/i);
  assert.match(out, /&lt;img/);
});
