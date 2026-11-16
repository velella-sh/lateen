// Named presets are files of brand options, discovered by listing the folder, so adding one needs no
// code change. Every preset has to pass the same contrast promises as a hand-written brand, an
// unknown name is refused with a visible comment, and a site's own values win over the preset.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { brandTokens, presetNames, problemComment, readPresets, resolveBrand, type BrandTokens } from "../src/brand.ts";
import { contrast, parseHex } from "../src/color.ts";

const PRESETS = presetNames();

const ratio = (a: string, b: string): number => {
  const first = parseHex(a);
  const second = parseHex(b);
  assert.ok(first !== undefined && second !== undefined);
  return contrast(first, second);
};

const at = (tokens: BrandTokens, name: string, scheme: "light" | "dark"): string => {
  const token = tokens[name];
  assert.ok(token !== undefined, `${name} is missing`);
  return tag(token, scheme);
};

const tag = (token: { readonly light: string; readonly dark: string }, scheme: "light" | "dark"): string =>
  scheme === "light" ? token.light : token.dark;

test("the shipped presets are the files in tokens/presets, sorted", () => {
  assert.deepEqual(PRESETS, ["clay", "graphite", "harbor", "orchard", "plum"]);
  assert.deepEqual([...readPresets().keys()], PRESETS);
});

test("every preset reaches every contrast pair in both schemes", () => {
  for (const name of PRESETS) {
    const result = resolveBrand({ preset: name });
    assert.deepEqual(result.problems, [], name);
    const brand = result.brand;
    assert.ok(brand !== undefined);
    assert.equal(brand.preset, name);
    const tokens = brandTokens(brand);
    for (const scheme of ["light", "dark"] as const) {
      const canvas = at(tokens, "color-canvas", scheme);
      const text = at(tokens, "color-text", scheme);
      for (const surface of [canvas, at(tokens, "color-surface", scheme), at(tokens, "color-surface-raised", scheme)]) {
        for (const role of ["accent", "accent-hover", "link", "link-hover"]) {
          assert.ok(ratio(at(tokens, `color-${role}`, scheme), surface) >= 4.5, `${name} ${scheme}: ${role} on ${surface}`);
        }
      }
      assert.ok(ratio(at(tokens, "color-on-accent", scheme), at(tokens, "color-accent", scheme)) >= 4.5, `${name} ${scheme}: on-accent`);
      assert.ok(ratio(text, at(tokens, "color-selection", scheme)) >= 4.5, `${name} ${scheme}: selection`);
      assert.ok(ratio(text, at(tokens, "color-surface", scheme)) >= 4.5, `${name} ${scheme}: text on surface`);
      assert.ok(ratio(at(tokens, "color-muted", scheme), at(tokens, "color-surface", scheme)) >= 4.5, `${name} ${scheme}: muted on surface`);
      assert.ok(ratio(at(tokens, "state-selected-fg", scheme), at(tokens, "state-selected-bg", scheme)) >= 4.5, `${name} ${scheme}: selected`);
    }
  }
});

test("a site's own value wins over the preset it names", () => {
  const result = resolveBrand({ preset: "harbor", brand: { accent: "#000000", radius: "large" } });
  assert.equal(result.brand?.accent, "#000000");
  assert.equal(result.brand?.radius, "large");
  assert.equal(result.brand?.neutral, "#8ea3b5", "an unset field keeps the preset's value");
});

test("an unknown preset is refused by name and becomes a visible comment", () => {
  const result = resolveBrand({ preset: "midnight" });
  assert.equal(result.brand, undefined);
  assert.deepEqual(result.problems.map((problem) => problem.option), ["theme.options.preset"]);
  assert.match(result.problems[0]?.message ?? "", /unknown preset "midnight"/);
  assert.match(problemComment(result.problems[0] ?? { option: "", message: "" }), /^\/\* lateen: ignored theme\.options\.preset: unknown preset "midnight" \*\/$/);
});

test("a value that is not a colour is ignored, and the rest of the preset is kept", () => {
  const result = resolveBrand({ preset: "orchard", brand: { accent: "green" } });
  assert.equal(result.brand?.accent, "#3f7d4e", "the preset's accent survives");
  assert.deepEqual(result.problems.map((problem) => problem.option), ["theme.options.brand.accent"]);
  assert.match(problemComment(result.problems[0] ?? { option: "", message: "" }), /is not a #rgb or #rrggbb colour/);
});

test("a preset file with a bad name stops the build instead of being skipped", () => {
  const dir = mkdtempSync(join(tmpdir(), "lateen-presets-"));
  try {
    writeFileSync(join(dir, "Bad Name.json"), JSON.stringify({ accent: "#000000" }));
    assert.throws(() => readPresets(dir), /lowercase kebab-case/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a preset from another folder is applied like a shipped one", () => {
  const dir = mkdtempSync(join(tmpdir(), "lateen-presets-"));
  try {
    writeFileSync(join(dir, "local.json"), JSON.stringify({ accent: "#123456", density: "compact" }));
    const result = resolveBrand({ preset: "local" }, dir);
    assert.deepEqual(result.problems, []);
    assert.equal(result.brand?.accent, "#123456");
    assert.equal(result.brand?.density, "compact");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
