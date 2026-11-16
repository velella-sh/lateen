// The brand derives every accent token from one colour and must keep the theme's contrast promises.
// The default palette is repeated in src/brand.ts so the derivation has a base; this test reads the
// shipped tokens and fails when that copy drifts. Twenty varied accents prove the derivation does
// not pass only the colours that happen to be easy.
import assert from "node:assert/strict";
import { test } from "node:test";
import { loadTokens } from "../scripts/tokens.ts";
import { brandCss, brandTokens, DEFAULT_CODE, DEFAULT_COLORS, DEFAULT_RADIUS, DEFAULT_SPACE, type BrandTokens } from "../src/brand.ts";
import { contrast, parseHex } from "../src/color.ts";

const shipped = loadTokens();
const value = (name: string, scheme: "light" | "dark"): string => {
  const token = shipped.get(name);
  const found = scheme === "light" ? token?.light : token?.dark ?? token?.light;
  assert.ok(found, `${name} has no ${scheme} value`);
  return found;
};

const ratio = (a: string, b: string): number => {
  const first = parseHex(a);
  const second = parseHex(b);
  assert.ok(first !== undefined && second !== undefined, `${a} / ${b} are colours`);
  return contrast(first, second);
};

const schemeValue = (tokens: BrandTokens, name: string, scheme: "light" | "dark"): string => {
  const token = tokens[name];
  assert.ok(token !== undefined, `${name} is missing`);
  return scheme === "light" ? token.light : token.dark;
};

/** Accents that cover dark, light, saturated, pastel, and grey inputs. */
const ACCENTS = [
  "#000000",
  "#ffffff",
  "#ff0000",
  "#00ff00",
  "#0000ff",
  "#ffff00",
  "#00ffff",
  "#ff00ff",
  "#808080",
  "#123456",
  "#abcdef",
  "#fedcba",
  "#1b1b1b",
  "#f5f5f5",
  "#a2553f",
  "#2f6f9f",
  "#3f7d4e",
  "#6b4f9e",
  "#e6b800",
  "#146c94",
] as const;

test("the default palette copied into src/brand.ts is the palette the tokens ship", () => {
  for (const scheme of ["light", "dark"] as const) {
    for (const [role, colour] of Object.entries(DEFAULT_COLORS[scheme])) assert.equal(value(`color-${role}`, scheme), colour, role);
    for (const [role, colour] of Object.entries(DEFAULT_CODE[scheme])) assert.equal(value(`code-${role}`, scheme), colour, role);
  }
  for (const [name, space] of Object.entries(DEFAULT_SPACE)) assert.equal(value(`space-${name}`, "light"), space, name);
  for (const [name, radius] of Object.entries(DEFAULT_RADIUS)) assert.equal(value(`radius-${name}`, "light"), radius, name);
});

test("every brand token keeps the name tokens/names.json freezes", () => {
  const names = new Set(shipped.keys());
  for (const accent of ACCENTS) for (const name of Object.keys(brandTokens({ accent }))) assert.ok(names.has(name), name);
  const neutral = Object.keys(brandTokens({ neutral: "#8a6a3f" }));
  assert.ok(neutral.includes("code-keyword"), "a tint re-checks the code colours");
  for (const name of neutral) assert.ok(names.has(name), name);
});

test("twenty accents keep their contrast pairs in both schemes", () => {
  for (const accent of ACCENTS) {
    const tokens = brandTokens({ accent });
    for (const scheme of ["light", "dark"] as const) {
      const canvas = DEFAULT_COLORS[scheme].canvas;
      const text = DEFAULT_COLORS[scheme].text;
      const surfaces = [canvas, DEFAULT_COLORS[scheme].surface, DEFAULT_COLORS[scheme]["surface-raised"]];
      const base = schemeValue(tokens, "color-accent", scheme);
      for (const surface of surfaces) {
        const onSurface = (name: string): number => ratio(schemeValue(tokens, name, scheme), surface);
        assert.ok(ratio(base, surface) >= 4.5, `${accent} ${scheme}: accent on ${surface}`);
        assert.ok(onSurface("color-accent-hover") >= 4.5, `${accent} ${scheme}: hover on ${surface}`);
        assert.ok(onSurface("color-link") >= 4.5, `${accent} ${scheme}: link on ${surface}`);
        assert.ok(onSurface("color-link-hover") >= 4.5, `${accent} ${scheme}: link hover on ${surface}`);
        assert.ok(onSurface("color-focus") >= 3, `${accent} ${scheme}: focus on ${surface}`);
        assert.ok(onSurface("state-focus-ring") >= 3, `${accent} ${scheme}: ring on ${surface}`);
      }
      assert.ok(ratio(schemeValue(tokens, "color-on-accent", scheme), base) >= 4.5, `${accent} ${scheme}: on-accent`);
      assert.ok(ratio(text, schemeValue(tokens, "color-selection", scheme)) >= 4.5, `${accent} ${scheme}: text on selection`);
      assert.ok(
        ratio(schemeValue(tokens, "state-selected-fg", scheme), schemeValue(tokens, "state-selected-bg", scheme)) >= 4.5,
        `${accent} ${scheme}: selected text`,
      );
    }
  }
});

test("a brand does not touch a category it does not set, and its CSS is deterministic", () => {
  assert.deepEqual(brandTokens({ radius: "large" }), {
    "radius-sm": { light: "0.375rem", dark: "0.375rem" },
    "radius-md": { light: "0.75rem", dark: "0.75rem" },
    "radius-lg": { light: "1.5rem", dark: "1.5rem" },
    "radius-ctl": { light: "0.5625rem", dark: "0.5625rem" },
    "radius-card": { light: "0.9375rem", dark: "0.9375rem" },
  });
  assert.deepEqual(brandTokens({}), {});
  const brand = { accent: "#2f6f9f", neutral: "#8ea3b5", radius: "medium" as const, density: "compact" as const };
  assert.equal(brandCss(brand), brandCss(brand));
  for (const token of Object.values(brandTokens(brand))) for (const scheme of [token.light, token.dark]) {
    if (scheme.startsWith("#")) assert.match(scheme, /^#[0-9a-f]{6}$/);
  }
});
