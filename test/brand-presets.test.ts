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
  assert.deepEqual(PRESETS, ["clay", "ebb", "graphite", "harbor", "lateen", "mizzen", "offing", "orchard", "plum"]);
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
        assert.ok(ratio(at(tokens, "color-focus", scheme), surface) >= 3, name);
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

test("the original presets keep their backdrop, motif, intensity and accent", () => {
  const accents: Record<string, string> = { clay: "#a2553f", graphite: "#4a5568", harbor: "#2f6f9f", orchard: "#3f7d4e", plum: "#6b4f9e" };
  for (const name of Object.keys(accents)) {
    const result = resolveBrand({ preset: name });
    assert.deepEqual(result.problems, [], name);
    const look = result.brand?.showpiece;
    assert.ok(look !== undefined, `${name} has a showpiece look`);
    assert.ok(["glow", "grid", "none"].includes(look.backdrop ?? ""), `${name} backdrop`);
    assert.ok((look.motif ?? "") !== "", `${name} motif`);
    assert.ok(["soft", "standard"].includes(look.intensity ?? ""), `${name} intensity`);
    assert.equal(result.brand?.accent, accents[name], `${name} keeps its accent`);
  }
  assert.equal(new Set(Object.keys(accents).map((name) => resolveBrand({ preset: name }).brand?.showpiece?.motif)).size, Object.keys(accents).length, "motif seeds differ");
});

test("text on each preset's backdrop keeps 4.5:1 in both schemes at the strongest tint", () => {
  const tint = { soft: 0.06, standard: 0.1 } as const;
  for (const name of PRESETS) {
    const brand = resolveBrand({ preset: name }).brand;
    assert.ok(brand);
    const tokens = brandTokens(brand);
    for (const scheme of ["light", "dark"] as const) {
      const canvas = parseHex(at(tokens, "color-canvas", scheme));
      const accent = parseHex(at(tokens, "color-accent", scheme));
      assert.ok(canvas !== undefined && accent !== undefined);
      const w: number = tint[brand.showpiece?.intensity ?? "standard"];
      const bg: { r: number; g: number; b: number } = { r: accent.r * w + canvas.r * (1 - w), g: accent.g * w + canvas.g * (1 - w), b: accent.b * w + canvas.b * (1 - w) };
      for (const role of ["text", "heading", "muted"]) {
        const fg = parseHex(at(tokens, `color-${role}`, scheme));
        assert.ok(fg !== undefined);
        assert.ok(contrast(fg, bg) >= 4.5, `${name} ${scheme}: ${role} on the backdrop`);
      }
    }
  }
});

test("a malformed showpiece option is ignored by name", () => {
  const result = resolveBrand({ brand: { showpiece: { backdrop: "swirl", intensity: "loud", motif: "" } } });
  assert.deepEqual(result.problems.map((problem) => problem.option), [
    "theme.options.brand.showpiece.backdrop",
    "theme.options.brand.showpiece.motif",
    "theme.options.brand.showpiece.intensity",
  ]);
});

test("family presets preserve the approved neutral roles and source accents in both schemes", () => {
  const family = {
    ebb: { light: "#3f6e66", dark: "#7aa89f" },
    lateen: { light: "#4c6f9a", dark: "#7e9cd8" },
    mizzen: { light: "#8a6220", dark: "#e6c384" },
    offing: { light: "#6a5590", dark: "#a592cc" },
  };
  for (const [preset, accent] of Object.entries(family)) {
    const { brand, problems } = resolveBrand({ preset });
    assert.deepEqual(problems, []);
    assert.ok(brand);
    assert.deepEqual(brand.accent, accent);
    const tokens = brandTokens(brand);
    assert.deepEqual(tokens["color-canvas"], { light: "#eceff4", dark: "#1f1f28" });
    assert.deepEqual(tokens["color-surface"], { light: "#e5e9f0", dark: "#2a2a37" });
    assert.deepEqual(tokens["color-text"], { light: "#2e3440", dark: "#dcd7ba" });
    assert.ok(ratio(at(tokens, "color-border-strong", "dark"), "#1f1f28") >= 3);
  }
  const { brand, problems } = resolveBrand({ preset: "lateen", brand: {
    accent: { light: "#123" },
    neutral: { light: { canvas: "#fff", text: "#333" }, dark: {} },
  } });
  assert.deepEqual(brand?.accent, family.lateen);
  assert.deepEqual(problems.map(({ option }) => option), ["theme.options.brand.accent", "theme.options.brand.neutral"]);
});
