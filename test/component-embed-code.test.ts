import assert from "node:assert/strict";
import { test } from "node:test";
import type { ComponentProps } from "@velella/mizzen/contracts";
import embedCode, { type EmbedCodeProps } from "../components/embed-code/index.ts";
import { frameSnippet } from "../components/embed-code/snippet.ts";
import { sourceText } from "../components/code/index.ts";
import { html, pageWith, siteWith } from "./helpers-embed.ts";

const embeddedPage = (url: string, extra: Record<string, unknown> = {}) =>
  pageWith({ url, title: "Guide", frontMatter: { description: "A short guide.", embedded: { of: "/guide/", height: 400, ...extra } } });

function render(props: EmbedCodeProps, pages = [embeddedPage("/embed/guide/")], url: string | null = "https://example.com") {
  const page = pageWith({ url: "/docs/" });
  const site = siteWith([page, ...pages], url === null ? {} : { url });
  return html(embedCode({ props, site, page, html: "" } as unknown as ComponentProps<EmbedCodeProps>));
}

const text = (out: string) => sourceText(out);

test("generates the iframe markup with an absolute address, title, size, lazy loading and sandbox", () => {
  const out = text(render({ src: "/embed/guide/" }));
  assert.match(out, /<iframe\s+src="https:\/\/example\.com\/embed\/guide\/"\s+title="Guide"\s+width="100%"\s+height="400"\s+loading="lazy"\s+sandbox="allow-popups allow-top-navigation-by-user-activation"\s+><\/iframe>/);
});

test("reuses the code component, so blocks get the code class that code-copy enhances", () => {
  const out = render({ src: "/embed/guide/" });
  assert.equal(out.match(/<pre class="code"/g)?.length, 3);
});

test("escapes the title in the markup", () => {
  const snippet = frameSnippet({ src: "https://e.com/a?x=1&y=2", title: 'A "b" <i>&', height: 300 });
  assert.match(snippet, /title="A &quot;b&quot; &lt;i&gt;&amp;"/);
  assert.match(snippet, /src="https:\/\/e\.com\/a\?x=1&amp;y=2"/);
  const out = text(render({ src: "/embed/guide/", title: 'x" onload="evil' }));
  assert.match(out, /title="x&quot; onload=&quot;evil"/);
  assert.doesNotMatch(out, /title="x" onload/);
});

test("without a site address it says so instead of showing code", () => {
  const out = render({ src: "/embed/guide/" }, [embeddedPage("/embed/guide/")], null);
  assert.match(out, /class="embed-code-diagnostic"/);
  assert.match(out, /absolute address/);
  assert.doesNotMatch(out, /<pre/);
});

test("an absolute src needs no site address", () => {
  const out = text(render({ src: "https://other.org/e/", title: "T" }, [], null));
  assert.match(out, /src="https:\/\/other\.org\/e\/"/);
});

test("renders nothing without src", () => {
  assert.equal(render({}), "");
});
