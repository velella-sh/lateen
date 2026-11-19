import assert from "node:assert/strict";
import { test } from "node:test";
import { h } from "preact";
import { renderToString } from "preact-render-to-string";
import home from "../layouts/home.ts";
import performanceChart from "../components/performance-chart/index.ts";
import { propsWith } from "./fixtures.ts";

function jsonPayload(html: string, attribute: string): unknown {
  const match = new RegExp(`${attribute}[^>]*>([\\s\\S]*?)</script>`).exec(html);
  assert.ok(match, `${attribute} script exists`);
  return JSON.parse(match[1]!);
}

test("the sailcloth shell mounts Pagefind search chrome", () => {
  const props = propsWith();
  const html = renderToString(h(home, props));
  assert.match(html, /data-site-header/);
  assert.match(html, /data-search-open/);
  assert.match(html, /class="search"/);
});

test("the chart island receives valid JSON", () => {
  const props = propsWith();
  const html = renderToString(h(performanceChart, { props: {}, page: props.page, site: props.site, html: "" }));
  const rows = jsonPayload(html, "data-chart-data");
  assert.ok(Array.isArray(rows));
});
