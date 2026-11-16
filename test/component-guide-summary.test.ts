import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToString } from "preact-render-to-string";
import type { Page, Site } from "@velella/mizzen/contracts";
import guideSummary, { factsOf } from "../components/guide-summary/index.ts";

function render(guide: unknown, values?: unknown, lang = "en"): string {
  const page = { frontMatter: { guide }, lang } as unknown as Page;
  const site = { config: { theme: { options: { status: { values } } } } } as unknown as Site;
  const node = guideSummary({ props: {}, page, site, html: "" } as never);
  return node === null ? "" : renderToString(node as never);
}

const VALUES = { low: { tone: "positive", label: { en: "Low risk", fa: "ریسک کم" } }, high: { tone: "negative", label: "High" } };

test("a full bar shows all four facts in order", () => {
  const html = render({ from: "v1", to: "v2", time: "10 min", risk: "low" }, VALUES);
  const order = ["from", "to", "time", "risk"].map((k) => html.indexOf(`data-fact="${k}"`));
  assert.deepEqual([...order].sort((a, b) => a - b), order);
  assert.ok(order.every((n) => n >= 0));
  assert.match(html, /<dt class="guide-summary-label">From<\/dt>/);
  assert.match(html, /10 min/);
});

test("a partial bar leaves out facts the front matter does not set", () => {
  const html = render({ to: "v2", time: "  " });
  assert.match(html, /data-fact="to"/);
  for (const k of ["from", "time", "risk"]) assert.doesNotMatch(html, new RegExp(`data-fact="${k}"`));
  assert.equal(render(undefined), "");
  assert.equal(render({}), "");
  assert.deepEqual(factsOf({ frontMatter: { guide: { time: 5 } } } as never), { time: "5" });
});

test("risk is a status mapped by the site, in the page language", () => {
  const html = render({ risk: "low" }, VALUES, "fa");
  assert.match(html, /status-positive/);
  assert.match(html, /ریسک کم/);
  assert.match(render({ risk: "high" }, VALUES), /status-negative/);
  // No fixed list: a value the site does not map shows as written, neutral.
  const unmapped = render({ risk: "spicy" }, VALUES);
  assert.match(unmapped, /status-neutral/);
  assert.match(unmapped, /spicy/);
});
