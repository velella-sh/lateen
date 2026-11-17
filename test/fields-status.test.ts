import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToString } from "preact-render-to-string";
import type { SiteConfig } from "@velella/mizzen/contracts";
import { EMPTY_CLASS, STATUS_CLASS, formatField, statusLabel } from "../src/fields.ts";

const config = {
  base: "",
  theme: {
    options: {
      status: {
        values: {
          done: { tone: "positive", label: { en: "Done", fa: "انجام شد", ar: "منجز" } },
          blocked: { tone: "negative", label: { en: "Blocked", fa: "مسدود", ar: "متوقف" } },
        },
      },
    },
  },
} as unknown as SiteConfig;

const render = (value: unknown, lang: string) => renderToString(formatField(value, "status", lang, config) as never);

test("a status fact renders the component with the mapped tone and label, and keeps the raw value", () => {
  const en = render("done", "en");
  assert.match(en, new RegExp(`class="${STATUS_CLASS}" data-value="done"`));
  assert.match(en, /class="status status-positive"/);
  assert.match(en, /data-tone="positive"/);
  assert.match(en, />Done<\/span>/);
  assert.match(render("done", "fa"), />انجام شد<\/span>/);
  assert.match(render("done", "ar"), />منجز<\/span>/);
});

test("a status column sorts and filters by the label, not the tone", () => {
  const values = ["done", "blocked"];
  // Tone order would put `blocked` (negative) before `done` (positive); the label order is the other way.
  const byLabel = [...values].sort((a, b) => statusLabel(a, "en", config).localeCompare(statusLabel(b, "en", config)));
  assert.deepEqual(byLabel, ["blocked", "done"]);
  assert.deepEqual(values.filter((v) => statusLabel(v, "en", config) === "Done"), ["done"]);
  assert.equal(statusLabel("blocked", "fa", config), "مسدود");
});

test("an unmapped value shows as written, neutral, and keeps its raw text", () => {
  const out = render("in-review", "en");
  assert.match(out, /class="status status-neutral"/);
  assert.match(out, /data-value="in-review"/);
  assert.match(out, />in-review<\/span>/);
  assert.equal(statusLabel("in-review", "en", config), "in-review");
});

test("empty and markup values never render raw HTML", () => {
  assert.equal(renderToString(formatField("", "status", "en", config) as never), `<span class="${EMPTY_CLASS}">No value</span>`);
  const out = render("<b>", "en");
  assert.ok(!out.includes("<b>"));
  assert.match(out, /data-value="&lt;b>"/);
});
