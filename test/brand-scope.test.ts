// A preset recolours the whole page: header, sidebar, footer and article read the same tokens, so the
// brand CSS sits on the page selector and not on the article. The studio preview keeps its own selector.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { brandCss, resolveBrand } from "../src/brand.ts";

const read = (path: string): string => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const css = (preset: string, selector?: string): string => {
  const { brand } = resolveBrand({ preset });
  assert.ok(brand !== undefined, `${preset} resolves`);
  return brandCss(brand, selector === undefined ? {} : { selector });
};

test("a preset's CSS is not scoped to the article", () => {
  for (const preset of ["lateen", "ebb", "graphite"]) {
    const out = css(preset);
    assert.doesNotMatch(out, /\.doc-body/, `${preset} must not scope to .doc-body`);
    assert.match(out, /:root:root \{[^}]*--color-canvas:/, `${preset} sets the canvas on the page`);
    assert.match(out, /:root:root \{[^}]*--background: var\(--color-canvas\)/, `${preset} bridges the canvas alias on the page`);
  }
});

test("the header, sidebar, footer and article read the colours a preset sets", () => {
  const chrome = read("styles/src/chrome.css");
  const base = read("styles/src/base.css");
  const theme = read("styles/src/theme.css");
  assert.match(theme, /--background: var\(--color-canvas\)/);
  assert.match(base, /background: var\(--background\)/, "the page reads the canvas");
  assert.match(chrome, /var\(--background\)/, "the chrome reads the canvas");
  assert.match(chrome, /var\(--card\)|var\(--color-surface/, "the chrome reads a surface role");
});

test("different presets give different page colours", () => {
  const canvas = (preset: string): string => /--color-canvas: ([^;]+);/.exec(css(preset))?.[1] ?? "";
  assert.notEqual(canvas("lateen"), "");
  assert.notEqual(canvas("lateen"), canvas("harbor"));
});

test("the studio preview keeps its own selector", () => {
  const out = css("lateen", ".brand-studio-sample");
  assert.match(out, /\.brand-studio-sample \{/);
  assert.doesNotMatch(out, /:root:root/);
});
