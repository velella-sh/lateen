import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { ComponentProps } from "@velella/mizzen/contracts";
import { renderToString } from "preact-render-to-string";
import statusLegend, { type StatusLegendProps } from "../components/status-legend/index.ts";

const values = {
  done: { tone: "positive", label: { en: "Done", fa: "انجام شد" }, description: { en: "Shipped.", fa: "منتشر شد." } },
  late: { tone: "negative", label: "Late", description: "Past its date." },
  draft: { tone: "info", label: "Draft" },
};
const config = { theme: { options: { status: { values } } } };

function render(props: StatusLegendProps, lang = "en", cfg: unknown = config): string {
  const input = { props, html: "", page: { lang }, site: { config: cfg } } as unknown as ComponentProps<StatusLegendProps>;
  const out = statusLegend(input);
  return out === null ? "" : renderToString(out as never);
}

test("lists every mapped value in map order, each as its badge", () => {
  const out = render({});
  assert.equal((out.match(/<li /g) ?? []).length, 3);
  assert.ok(out.indexOf("Done") < out.indexOf("Late") && out.indexOf("Late") < out.indexOf("Draft"));
  assert.match(out, /status-positive/);
  assert.match(out, /status-negative/);
  assert.match(out, /status-info/);
  assert.match(out, /<ul class="status-legend"/);
});

test("values lists a subset in the given order, skipping unmapped and repeated ones", () => {
  const out = render({ values: " late, done ,nope,late" });
  assert.equal((out.match(/<li /g) ?? []).length, 2);
  assert.ok(out.indexOf("Late") < out.indexOf("Done"));
  assert.doesNotMatch(out, /Draft|nope/);
  assert.match(render({ values: ["draft"] }), /Draft/);
  assert.equal(render({ values: "nope" }), "");
});

test("shows the description in the page language when the options have one", () => {
  assert.match(render({}), /status-legend-description">Shipped\.</);
  assert.match(render({}, "fa"), /status-legend-description">منتشر شد\.</);
  assert.match(render({}), /status-legend-description">Past its date\.</);
  const draft = render({ values: "draft" });
  assert.doesNotMatch(draft, /status-legend-description/);
});

test("renders nothing when the site maps no value", () => {
  for (const cfg of [null, {}, { theme: {} }, { theme: { options: { status: { values: {} } } } }, { theme: { options: { status: { values: [] } } } }]) {
    assert.equal(render({}, "en", cfg), "");
  }
});

test("escapes descriptions and keeps the source position", () => {
  const cfg = { theme: { options: { status: { values: { x: { tone: "info", description: "<b>hi</b>" } } } } } };
  const out = render({ src: "a.md:3" }, "en", cfg);
  assert.match(out, /&lt;b>hi&lt;\/b>/);
  assert.match(out, /data-src="a\.md:3"/);
});

test("the stylesheet uses logical properties and tokens only", () => {
  const css = readFileSync(new URL("../components/status-legend/style.css", import.meta.url), "utf8");
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|\b(left|right)\b|margin-left|margin-right|padding-left|padding-right/i);
});
