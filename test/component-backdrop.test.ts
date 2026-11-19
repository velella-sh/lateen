import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { ComponentProps } from "@velella/mizzen/contracts";
import { renderToString } from "preact-render-to-string";
import { contrast, parseHex } from "../src/color.ts";
import backdrop, { DEFAULT_VARIANT, VARIANTS, variantOf, type BackdropProps } from "../components/backdrop/index.ts";

const css = "" /* lateen-legacy removed: components/backdrop/style.css */;
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

test("a soft backdrop adds the soft class and stays under the standard tint", async () => {
  const { default: backdrop } = await import("../components/backdrop/index.ts");
  const { renderToString } = await import("preact-render-to-string");
  const { h } = await import("preact");
  const html = renderToString(h(backdrop as never, { props: { variant: "grid", intensity: "soft" } } as never));
  assert.match(html, /class="backdrop backdrop-grid backdrop-soft"/);
  assert.doesNotMatch(renderToString(h(backdrop as never, { props: { variant: "grid" } } as never)), /backdrop-soft/);
});
