// Syntax colours follow the brand: the block background comes from the tinted surface, and every
// syntax token is re-checked against that background, not the theme's original one. The Shiki theme
// that highlights the code keeps its own choice; these are the token colours the theme's CSS uses.
import assert from "node:assert/strict";
import { test } from "node:test";
import { h } from "preact";
import { renderToString } from "preact-render-to-string";
import code, { adjustShiki } from "../components/code/index.ts";
import { brandTokens, codeBackgrounds, DEFAULT_CODE, presetNames, resolveBrand, type BrandTokens } from "../src/brand.ts";
import { contrast, parseHex } from "../src/color.ts";

const SYNTAX = ["comment", "keyword", "string", "number", "function", "tag", "punctuation"] as const;

const ratio = (a: string, b: string): number => {
  const first = parseHex(a);
  const second = parseHex(b);
  assert.ok(first !== undefined && second !== undefined, `${a} / ${b}`);
  return contrast(first, second);
};

const at = (tokens: BrandTokens, name: string, scheme: "light" | "dark"): string => {
  const token = tokens[name];
  assert.ok(token !== undefined, `${name} is missing`);
  return scheme === "light" ? token.light : token.dark;
};

test("every syntax colour reads on the derived background for every preset", () => {
  for (const name of presetNames()) {
    const brand = resolveBrand({ preset: name }).brand;
    assert.ok(brand !== undefined);
    const tokens = brandTokens(brand);
    for (const scheme of ["light", "dark"] as const) {
      const bg = at(tokens, "code-bg", scheme);
      for (const role of ["fg", ...SYNTAX]) {
        assert.ok(ratio(at(tokens, `code-${role}`, scheme), bg) >= 4.5, `${name} ${scheme}: ${role} on ${bg}`);
      }
      assert.equal(at(tokens, "code-border", scheme), at(tokens, "color-border", scheme), `${name} ${scheme}: border`);
      assert.equal(at(tokens, "code-line-highlight", scheme), DEFAULT_CODE[scheme]["line-highlight"], `${name} ${scheme}: highlight`);
    }
  }
});

test("the code background follows the neutral tint but keeps the block's darkness", () => {
  for (const tint of ["#8a6a3f", "#3f6a8a"]) {
    const tokens = brandTokens({ neutral: tint });
    for (const scheme of ["light", "dark"] as const) {
      const bg = at(tokens, "code-bg", scheme);
      assert.notEqual(bg, DEFAULT_CODE[scheme].bg, `${tint} ${scheme}: the background is tinted`);
      const original = parseHex(DEFAULT_CODE[scheme].bg);
      const derived = parseHex(bg);
      assert.ok(original !== undefined && derived !== undefined);
      assert.ok(Math.abs(original.r - derived.r) < 40, `${tint} ${scheme}: the background stays close to the shipped one`);
    }
  }
});

test("an accent alone does not rewrite the code group", () => {
  const tokens = brandTokens({ accent: "#2f6f9f" });
  assert.deepEqual(Object.keys(tokens).filter((name) => name.startsWith("code-")), []);
});

test("highlighted tokens are lifted onto the brand's code background", () => {
  const line = '<span style="--shiki-light:#0a3069;--shiki-dark:#a5d6ff">x</span>';
  const adjusted = adjustShiki(line, { light: "#333333", dark: "#ffffff" });
  const light = /--shiki-light:(#[0-9a-f]{6})/.exec(adjusted)?.[1] ?? "";
  const dark = /--shiki-dark:(#[0-9a-f]{6})/.exec(adjusted)?.[1] ?? "";
  assert.ok(ratio(light, "#333333") >= 4.5, `light ${light}`);
  assert.ok(ratio(dark, "#ffffff") >= 4.5, `dark ${dark}`);
  assert.equal(adjustShiki(line, undefined), line, "without a brand nothing changes");
  assert.match(adjustShiki('<span style="--shiki-light:inherit">x</span>', { light: "#ffffff", dark: "#000000" }), /inherit/);
});

test("a rendered code block keeps every emitted token readable on the preset's background", () => {
  for (const name of presetNames()) {
    const options = { preset: name };
    const site = { config: { base: "", theme: { options } } };
    const html = renderToString(
      code({ props: { lang: "ts" }, html: "const answer = 42;", page: {}, site } as never) as never,
    );
    const backgrounds = codeBackgrounds(options);
    const emitted = [...html.matchAll(/--shiki-(light|dark):(#[0-9a-f]{6})/g)];
    assert.ok(emitted.length > 0, `${name}: the block is highlighted`);
    for (const [, mode, colour] of emitted) {
      const against = mode === "light" ? backgrounds.light : backgrounds.dark;
      assert.ok(ratio(colour ?? "", against) >= 4.5, `${name} ${mode}: ${colour} on ${against}`);
    }
  }
});

test("the code background a preset produces comes from its neutral", () => {
  const options = { preset: "harbor" };
  const backgrounds = codeBackgrounds(options);
  assert.notEqual(backgrounds.light, DEFAULT_CODE.light.bg);
  assert.notEqual(backgrounds.dark, DEFAULT_CODE.dark.bg);
  assert.deepEqual(codeBackgrounds({}), { light: DEFAULT_CODE.light.bg, dark: DEFAULT_CODE.dark.bg });
});
