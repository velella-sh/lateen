// The RTL integration fixture proves the mirroring contract on a built page: a Persian doc with code,
// a table, a calendar action, and version controls. Directional arrows mirror; neutral icons do not.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { build } from "./integration-helpers.ts";
import { readUiCss } from "./ui-css-helpers.ts";

const read = (path: string): string => readFileSync(new URL(path, import.meta.url), "utf8");

test("the Persian fixture page carries every control the RTL icon contract covers", () => {
  const document = build("integration").document("/fa/guide/install/");
  assert.equal(document.documentElement.getAttribute("dir"), "rtl");
  assert.equal(document.documentElement.getAttribute("lang"), "fa");
  assert.ok(document.querySelector("pre code"), "the page has no code block");
  assert.ok(document.querySelector("main table"), "the page has no table");
  assert.ok(document.querySelector(".dated-list-action"), "the dated list has no calendar action");
  assert.ok(document.querySelector(".version-switcher"), "the page has no version switcher");
  if (document.querySelector(".pager") !== null) {
    assert.ok(document.querySelector(".pager-arrow"), "the pager renders without its arrow");
  }
});

test("the RTL rule mirrors directional icons and leaves neutral ones alone", () => {
  const css = readUiCss();
  const rule = /\[dir="rtl"\][^{]*:is\(([^)]*)\)[^{]*\{[^}]*transform:\s*scaleX\(-1\)/.exec(css);
  assert.ok(rule, "ui.css has no [dir=\"rtl\"] mirror rule");
  const mirrored = (rule[1] ?? "").split(",").map((name) => name.trim());
  assert.ok(mirrored.includes(".pager-arrow"), `the rule does not mirror .pager-arrow: ${mirrored.join(", ")}`);
  assert.doesNotMatch(rule[0] ?? "", /theme-toggle|copy|check/, "neutral icons must keep their orientation");
});
