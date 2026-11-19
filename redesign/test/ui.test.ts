import assert from "node:assert/strict";
import { test } from "node:test";
import { h } from "preact";
import { renderToString } from "preact-render-to-string";
import { ArrowRight } from "lucide";
import type { ComponentProps } from "@velella/mizzen/contracts";
import { propsWith } from "./fixtures.ts";

const iconModule = await import("../src/icon.ts").catch(() => undefined);
const homeModule = await import("../layouts/home.ts").catch(() => undefined);
const docModule = await import("../layouts/doc.ts").catch(() => undefined);
const calloutModule = await import("../components/callout/index.ts").catch(() => undefined);
const chartModule = await import("../components/performance-chart/index.ts").catch(() => undefined);
const shellModule = await import("../chrome/shell/client.ts").catch(() => undefined);
const codeModule = await import("../src/code.ts").catch(() => undefined);

test("Lucide icons render as decorative SSR SVG without a browser", () => {
  assert.ok(iconModule);
  const html = renderToString(h(iconModule.icon, { node: ArrowRight, class: "size-5" }));
  assert.match(html, /^<svg[^>]*class="size-5"/);
  assert.match(html, /aria-hidden="true"/);
  assert.match(html, /<path d="M5 12h14"/);
});

test("home uses Basecoat actions and cards with the authored content", () => {
  assert.ok(homeModule);
  const props = propsWith({
    hero: { eyebrow: "v0.2.2", title: "Easy to read. Safe to edit.", lead: "A calmer docs theme." },
    actions: [{ label: "Install", url: "/install/", primary: true }, { label: "Components", url: "/components/" }],
    sections: [{ title: "Start", url: "/install/", description: "Build a site.", links: [{ title: "Quickstart", url: "/install/" }] }],
  });
  const html = renderToString(h(homeModule.default, props));
  assert.match(html, /class="btn home-btn-primary"[^>]*data-size="lg"/);
  assert.match(html, /data-variant="outline"/);
  assert.match(html, /class="card home-section"/);
  assert.match(html, /Easy to read\. Safe to edit\./);
  assert.match(html, /Quickstart/);
  assert.match(html, /<main id="main"/);
  assert.match(html, /<a class="brand" href="\/lateen\/">/);
});

test("document pages render their description, navigation, toc and highlighted body", () => {
  assert.ok(docModule);
  const props = propsWith(
    { title: "Install", description: "Install Lateen.", layout: "doc" },
    '<h2 id="use">Use it</h2><pre><code class="language-sh">npm install</code></pre><table><tr><td>One</td></tr></table>',
  );
  const page = { ...props.page, headings: [{ depth: 2 as const, id: "use", text: "Use it", pos: props.page.source }] };
  const html = renderToString(h(docModule.default, { ...props, page }));
  assert.match(html, /Install Lateen\./);
  assert.match(html, /aria-label="On this page"/);
  assert.match(html, /href="#use"/);
  assert.match(html, /data-lang="sh"/);
  assert.match(html, /class="doc-body"/);
  assert.match(html, /class="docs-sidebar"/);
  assert.doesNotMatch(html, /class="sidebar"/);
  assert.match(html, /<table tabindex="0" role="region" aria-label="Scrollable table">/);
});

test("callouts keep their accessible name and normalize aliases and unknown kinds", () => {
  assert.ok(calloutModule);
  assert.equal(calloutModule.calloutKind("danger"), "caution");
  assert.equal(calloutModule.calloutKind("unknown"), "note");
  const props = propsWith();
  const input: ComponentProps<{ type: string; title: string }> = {
    props: { type: "tip", title: "Check first" },
    page: props.page,
    site: props.site,
    html: "<p>Node 24 or later.</p>",
  };
  const html = renderToString(h(calloutModule.default, input));
  assert.match(html, /role="note"/);
  assert.match(html, /aria-labelledby="callout-tip-title"/);
  assert.match(html, /id="callout-tip-title"/);
  assert.match(html, /Check first/);
});

test("the chart has a readable table and a lazy canvas enhancement", () => {
  assert.ok(chartModule);
  const props = propsWith();
  const html = renderToString(h(chartModule.default, { props: {}, page: props.page, site: props.site, html: "" }));
  assert.match(html, /<canvas[^>]*hidden/);
  assert.match(html, /data-performance-chart/);
  assert.match(html, /<table/);
  assert.match(html, /Budgets, not measurements/);
  assert.match(html, /Lazy chart/);
});

test("search ranks title matches and ignores blank queries", () => {
  assert.ok(shellModule);
  const pages = [
    { title: "Components", description: "Every block", url: "/components/" },
    { title: "Install", description: "Components and setup", url: "/install/" },
  ];
  assert.deepEqual(shellModule.searchPages(pages, " "), []);
  assert.deepEqual(shellModule.searchPages(pages, "comp").map((page) => page.url), ["/components/", "/install/"]);
});

test("code highlighting escapes source and preserves the language", () => {
  assert.ok(codeModule);
  const html = codeModule.highlightFences('<pre><code class="language-sh">echo &lt;ok&gt;</code></pre>');
  assert.match(html, /data-lang="sh"/);
  assert.match(html, /shiki/);
  assert.doesNotMatch(html, /<ok>/);
});
