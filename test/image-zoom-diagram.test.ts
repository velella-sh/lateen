// A Mermaid diagram and the SVG charts zoom with the same panel as an image, drawn from the SVG they
// already have, so the panel needs no chart script and no second render (#1468).
import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToString } from "preact-render-to-string";
import type { ComponentProps } from "@velella/mizzen/contracts";
import mermaid, { prefixIds, type MermaidProps } from "../components/mermaid/index.ts";
import barChart, { type BarChartProps } from "../components/bar-chart/index.ts";

function ctx<P extends Readonly<Record<string, unknown>>>(props: P, site: object = {}) {
  return { props, html: "", page: { lang: "en", dir: "ltr" } as ComponentProps["page"], site } as unknown as ComponentProps<P>;
}

test("prefixIds renames ids and every reference to them", () => {
  const svg =
    '<svg id="m-0"><style>#m-0 .a{fill:red}</style><defs><marker id="m-0_end"/></defs><path marker-end="url(#m-0_end)"/><title id="t" ></title><g aria-labelledby="t"/></svg>';
  const out = prefixIds(svg, "z-");
  assert.match(out, /<svg id="z-m-0">/);
  assert.match(out, /#z-m-0 \.a/);
  assert.match(out, /id="z-m-0_end"/);
  assert.match(out, /url\(#z-m-0_end\)/);
  assert.match(out, /aria-labelledby="z-t"/);
  assert.doesNotMatch(out.replace(/z-/g, ""), /z-/);
});

test("a zoomed diagram shows the same SVG in its button and its panel, with no repeated id", () => {
  const html = renderToString(mermaid(ctx<MermaidProps>({ source: "flowchart LR\n  A --> B", alt: "A to B", zoom: "true" })) as never);
  assert.match(html, /<button type="button" class="figure-zoom" popovertarget="mermaid-zoom"/);
  assert.match(html, /<div id="mermaid-zoom" popover="auto" class="figure-zoom-panel" role="dialog" aria-label="A to B"/);
  assert.equal((html.match(/<svg\b/g) ?? []).length, 2);
  assert.doesNotMatch(html, /Open full size/);
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(ids).size, ids.length, "ids are unique");
  assert.doesNotMatch(html, /<script(?![^>]*application\/json)/);
});

test("a diagram without zoom is unchanged", () => {
  const html = renderToString(mermaid(ctx<MermaidProps>({ source: "flowchart LR\n  A --> B", alt: "A to B" })) as never);
  assert.doesNotMatch(html, /popover/);
  assert.equal((html.match(/<svg\b/g) ?? []).length, 1);
});

test("a zoomed bar chart opens the same bars larger, with its own title id", () => {
  const site = { collections: {}, data: { sales: [{ id: "a", value: 3 }, { id: "b", value: 5 }] } };
  const html = renderToString(barChart(ctx<BarChartProps>({ from: "sales", zoom: "true" }, site)) as never);
  assert.match(html, /popovertarget="bar-chart-sales-zoom"/);
  assert.equal((html.match(/<svg\b/g) ?? []).length, 2);
  assert.match(html, /class="bar-chart-svg figure-zoom-svg"/);
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(ids).size, ids.length, "ids are unique");
  assert.doesNotMatch(renderToString(barChart(ctx<BarChartProps>({ from: "sales" }, site)) as never), /popover/);
});

test("a fence cannot carry zoom, so images.zoom auto zooms a diagram wider than the column", () => {
  const wide = "flowchart LR\n" + Array.from({ length: 12 }, (_, n) => `  N${n}[A long node label number ${n}] --> N${n + 1}[Another long label ${n + 1}]`).join("\n");
  const auto = { config: { theme: { options: { images: { zoom: "auto" } } } } };
  const html = (source: string, props: object = {}, site: object = {}) =>
    renderToString(mermaid(ctx<MermaidProps>({ source, alt: "d", ...props }, site)) as never);
  assert.match(html(wide, {}, auto), /class="figure-zoom-panel"/);
  assert.doesNotMatch(html(wide, { zoom: "false" }, auto), /popover/);
  assert.doesNotMatch(html(wide), /popover/, "off by default");
  assert.doesNotMatch(html("flowchart LR\n  A --> B", {}, auto), /popover/, "a small diagram stays as it is");
});
