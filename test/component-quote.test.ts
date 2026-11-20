import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { renderToString } from "preact-render-to-string";
import type { ComponentProps } from "@velella/mizzen/contracts";
import quote, { CAPTION_CLASS, ROOT_CLASS, sourceHref, type QuoteProps } from "../components/quote/index.ts";
import { readUiCss } from "./ui-css-helpers.ts";

const root = fileURLToPath(new URL("../", import.meta.url));

function render(props: QuoteProps, html = ""): string | null {
  const node = quote({ props, html } as unknown as ComponentProps<QuoteProps>);
  return node === null ? null : renderToString(node as never);
}

test("a quotation with a name and a safe source is a figure with an attribution", () => {
  const out = render({ text: "The smallest change that works.", name: "A reviewer", source: "https://example.com/guide/" });
  assert.ok(out);
  assert.ok(out.startsWith(`<figure class="${ROOT_CLASS}">`));
  assert.ok(out.includes('<blockquote class="quote-body" cite="https://example.com/guide/"><p>The smallest change that works.</p></blockquote>'));
  assert.ok(
    out.includes(
      `<figcaption class="${CAPTION_CLASS}">A reviewer, <a href="https://example.com/guide/" rel="noopener">https://example.com/guide/</a></figcaption>`,
    ),
  );
});

test("a quotation without an attribution is a bare blockquote", () => {
  const out = render({ text: "No attribution." });
  assert.equal(out, `<blockquote class="${ROOT_CLASS}"><p>No attribution.</p></blockquote>`);
  assert.ok(!out.includes("figure"));
  assert.ok(!out.includes("figcaption"));
});

test("an unsafe source is not rendered as a link", () => {
  for (const source of ["javascript:alert(1)", "data:text/html,<script>", "//example.com/guide", "https://example.com/a b"]) {
    const out = render({ text: "Quoted.", name: "A reviewer", source });
    assert.ok(out, source);
    assert.ok(!out.includes("<a "), `${source} became a link`);
    assert.ok(!out.includes("cite="), `${source} became a citation address`);
  }
});

test("the directive body is the quotation when text is absent", () => {
  const out = render({ name: "A reviewer" }, "<p>From the body.</p>");
  assert.equal(
    out,
    `<figure class="${ROOT_CLASS}"><blockquote class="quote-body"><p>From the body.</p></blockquote><figcaption class="${CAPTION_CLASS}">A reviewer</figcaption></figure>`,
  );
});

test("an empty quotation renders nothing", () => {
  assert.equal(render({}), null);
  assert.equal(render({ name: "A reviewer" }), null);
});

test("the quotation's text wraps instead of clipping", () => {
  const css = readUiCss();
  const rule = /\.quote\s*\{([^}]*)\}/.exec(css);
  assert.ok(rule, "styles/src/ui.css has no .quote rule");
  const body = rule[1] ?? "";
  assert.match(body, /overflow-wrap:\s*anywhere/);
  assert.ok(!/text-overflow|white-space:\s*nowrap|overflow:\s*hidden/.test(body));
});

test("sourceHref takes only absolute http(s) addresses", () => {
  assert.equal(sourceHref("https://example.com/a"), "https://example.com/a");
  assert.equal(sourceHref("http://example.com/a"), "http://example.com/a");
  assert.equal(sourceHref(" https://example.com/a "), "https://example.com/a");
  assert.equal(sourceHref("javascript:alert(1)"), undefined);
  assert.equal(sourceHref("/local/path/"), undefined);
  assert.equal(sourceHref(undefined), undefined);
});
