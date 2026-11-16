import assert from "node:assert/strict";
import { test } from "node:test";
import type { ComponentProps } from "@velella/mizzen/contracts";
import { renderToString } from "preact-render-to-string";
import status, { type StatusProps } from "../components/status/index.ts";
import { resolveStatus } from "../components/status/values.ts";

const values = {
  done: { tone: "positive", label: { en: "Done", fa: "انجام شد", ar: "تم" } },
  late: { tone: "negative", label: "Late" },
  draft: { tone: "info", label: { en: "Draft" } },
};
const config = { theme: { options: { status: { values } } } };

function render(props: StatusProps, lang = "en", cfg: unknown = config): string {
  const input = { props, html: "", page: { lang }, site: { config: cfg } } as unknown as ComponentProps<StatusProps>;
  return renderToString(status(input) as never);
}

test("a mapped value shows its tone and the label in three languages", () => {
  for (const [lang, label] of [["en", "Done"], ["fa", "انجام شد"], ["ar", "تم"]] as const) {
    const out = render({ value: "done" }, lang);
    assert.match(out, /status-positive/);
    assert.match(out, new RegExp(`status-label">${label}<`));
  }
  assert.match(render({ value: "done" }, "fa-IR"), />انجام شد</);
});

test("a plain string label serves every language, and a missing language falls back to English then the raw value", () => {
  assert.match(render({ value: "late" }, "fa"), /status-negative[\s\S]*>Late</);
  assert.match(render({ value: "draft" }, "ar"), /status-info[\s\S]*>Draft</);
  assert.deepEqual(resolveStatus("x", "fa", { theme: { options: { status: { values: { x: { tone: "info", label: { ar: "س" } } } } } } } as never), { tone: "info", label: "x" });
});

test("an unmapped value shows raw and neutral, escaped", () => {
  const out = render({ value: "<odd>" });
  assert.match(out, /status-neutral/);
  assert.match(out, />&lt;odd></);
  assert.match(render({ value: "toString" }), /status-neutral[\s\S]*>toString</);
});

test("a site without the option, or with a malformed one, shows raw and neutral", () => {
  for (const cfg of [null, {}, { theme: {} }, { theme: { options: {} } }, { theme: { options: { status: { values: [] } } } }, { theme: { options: { status: "x" } } }]) {
    assert.match(render({ value: "done" }, "en", cfg), /status-neutral[\s\S]*>done</);
  }
});
