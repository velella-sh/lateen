import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { ComponentProps } from "@velella/mizzen/contracts";
import { renderToString } from "preact-render-to-string";
import { contrast, parseHex } from "../src/color.ts";
import backdrop, { DEFAULT_VARIANT, VARIANTS, variantOf, type BackdropProps } from "../components/backdrop/index.ts";

const css = readFileSync(new URL("../components/backdrop/style.css", import.meta.url), "utf8");
const tokens = readFileSync(new URL("../styles/tokens.css", import.meta.url), "utf8");
const names = JSON.parse(readFileSync(new URL("../tokens/names.json", import.meta.url), "utf8")) as Record<string, Record<string, unknown>>;

function render(props: BackdropProps): string {
  const out = backdrop({ props, html: "" } as unknown as ComponentProps<BackdropProps>);
  return out === null ? "" : renderToString(out as never);
}

/** The light and dark values of a colour token, from the generated stylesheet. */
function pair(name: string): { light: string; dark: string } {
  const m = tokens.match(new RegExp(`--color-${name}: light-dark\\((#[0-9a-fA-F]{6}), (#[0-9a-fA-F]{6})\\)`));
  assert.ok(m, `--color-${name} is a light-dark pair`);
  return { light: m[1]!, dark: m[2]! };
}

/** `color-mix(in srgb, top weight, bottom)` for hex colours. */
function mixSrgb(top: string, weight: number, bottom: string) {
  const a = parseHex(top)!;
  const b = parseHex(bottom)!;
  return {
    r: a.r * weight + b.r * (1 - weight),
    g: a.g * weight + b.g * (1 - weight),
    b: a.b * weight + b.b * (1 - weight),
  };
}

test("glow draws an aria-hidden element with its variant class", () => {
  const out = render({ variant: "glow" });
  assert.match(out, /^<div class="backdrop backdrop-glow" aria-hidden="true"><\/div>$/);
});

test("grid draws an aria-hidden element with its variant class", () => {
  assert.match(render({ variant: "grid" }), /^<div class="backdrop backdrop-grid" aria-hidden="true"><\/div>$/);
});

test("none draws nothing", () => {
  assert.equal(render({ variant: "none" }), "");
});

test("an unknown or missing variant falls back to the default", () => {
  assert.equal(DEFAULT_VARIANT, "glow");
  for (const variant of [undefined, "", "spin", "GLOW"]) assert.match(render({ variant }), /backdrop-glow/);
  assert.equal(variantOf(7), "glow");
  assert.deepEqual([...VARIANTS], ["glow", "grid", "none"]);
  assert.equal(renderToString(backdrop({ html: "" } as never) as never).includes("backdrop-glow"), true);
});

test("each drawn variant has CSS built from gradients and colour mixing on the accent token", () => {
  for (const variant of ["glow", "grid"]) {
    const rule = css.match(new RegExp(`\\.backdrop-${variant} \\{([^}]*)\\}`, "s"))?.[1] ?? "";
    assert.match(rule, /gradient\(/, variant);
    assert.match(rule, /color-mix\(in srgb, var\(--color-accent\)/, variant);
  }
});

test("uses no image file, no remote origin and no animation", () => {
  assert.doesNotMatch(css, /url\(|@import|https?:|image-set/);
  assert.doesNotMatch(css, /animation|transition|@keyframes/);
});

test("draws nothing in print and under forced colours", () => {
  for (const query of ["print", "(forced-colors: active)"]) {
    const start = css.indexOf(`@media ${query} {`);
    assert.ok(start >= 0, query);
    assert.match(css.slice(start, css.indexOf("\n}", start)), /\.backdrop \{\s*display: none;/, query);
  }
});

test("text keeps 4.5:1 at the strongest tint in light and dark", () => {
  const weights = [...css.matchAll(/color-mix\(in srgb, var\(--color-accent\) (\d+)%/g)].map((m) => Number(m[1]) / 100);
  assert.ok(weights.length > 0);
  const worst = Math.max(...weights);
  const accent = pair("accent");
  const canvas = pair("canvas");
  for (const theme of ["light", "dark"] as const) {
    const bg = mixSrgb(accent[theme], worst, canvas[theme]);
    for (const token of ["text", "heading", "muted"]) {
      const fg = parseHex(pair(token)[theme])!;
      const ratio = contrast(fg, bg);
      assert.ok(ratio >= 4.5, `${token} on the ${theme} backdrop is ${ratio.toFixed(2)}:1`);
    }
  }
});

test("style.css uses only token custom properties and logical properties", () => {
  const allowed = new Set<string>();
  for (const [group, entries] of Object.entries(names)) for (const key of Object.keys(entries)) allowed.add(`--${group}-${key}`);
  const used = [...css.matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1]!);
  assert.deepEqual([...new Set(used)].filter((n) => !allowed.has(n)), []);
  assert.doesNotMatch(css, /\b(?:margin|padding|border)-(?:left|right)\b|\b(?:left|right)\s*:/);
});
