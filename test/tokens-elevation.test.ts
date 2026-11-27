import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { loadTokens, paths } from "../scripts/tokens.ts";

const LEVELS = ["low", "mid", "high"];

test("the radius scale has the steps the system note names, in increasing order (#1292)", () => {
  const tokens = loadTokens();
  const px = (name: string): number => {
    const value = tokens.get(`radius-${name}`)?.light ?? "";
    return value.endsWith("rem") ? Number.parseFloat(value) * 16 : Number.parseFloat(value);
  };
  const scale = ["xs", "sm", "md", "lg", "xl"].map(px);
  for (let index = 1; index < scale.length; index += 1) assert.ok((scale[index] ?? 0) > (scale[index - 1] ?? 0), "radius grows");
  assert.ok(tokens.has("radius-ctl") && tokens.has("radius-card") && tokens.has("radius-full"));
});

test("every elevation level carries a border in dark, and a shadow only in light (#1292)", () => {
  const tokens = loadTokens();
  for (const level of LEVELS) {
    assert.ok(tokens.get(`elevation-${level}-border`)?.dark, `elevation-${level}-border has no dark value`);
    const shadow = tokens.get(`elevation-${level}-shadow`)?.light ?? "";
    assert.match(shadow, /light-dark\(.*, transparent\)/, `elevation-${level}-shadow is invisible in dark`);
  }
});

test("no shadow is drawn in forced colours (#1292)", () => {
  const css = readFileSync(paths.css, "utf8");
  const block = css.slice(css.indexOf("@media (forced-colors: active)"), css.indexOf(':root[data-theme="light"]'));
  for (const level of LEVELS) assert.match(block, new RegExp(`--elevation-${level}-shadow: none;`));
  for (const name of ["sm", "md", "lg", "popover", "dialog"]) assert.match(block, new RegExp(`--shadow-${name}: none;`));
});
