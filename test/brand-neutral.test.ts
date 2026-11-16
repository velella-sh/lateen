// A neutral tint changes hue and chroma of the surfaces and keeps the theme's lightness steps, so a
// site gets a warmer or cooler grey without the page turning into a different design. Text and muted
// text keep their contrast on every surface the tint moves, in both schemes.
import assert from "node:assert/strict";
import { test } from "node:test";
import { brandTokens, DEFAULT_COLORS } from "../src/brand.ts";
import { contrast, parseHex, toOklch } from "../src/color.ts";

const TINTS = { warm: "#8a6a3f", cool: "#3f6a8a", grey: "#777777" } as const;

const ratio = (a: string, b: string): number => {
  const first = parseHex(a);
  const second = parseHex(b);
  assert.ok(first !== undefined && second !== undefined);
  return contrast(first, second);
};

const schemeValue = (tokens: ReturnType<typeof brandTokens>, name: string, scheme: "light" | "dark"): string => {
  const token = tokens[name];
  assert.ok(token !== undefined, `${name} is missing`);
  return scheme === "light" ? token.light : token.dark;
};

test("warm, cool, and grey tints keep every text pair readable", () => {
  for (const tint of Object.values(TINTS)) {
    const tokens = brandTokens({ neutral: tint });
    for (const scheme of ["light", "dark"] as const) {
      const surfaces = ["color-canvas", "color-surface", "color-surface-raised"].map((name) => schemeValue(tokens, name, scheme));
      for (const role of ["color-text", "color-heading", "color-muted"]) {
        for (const surface of surfaces) {
          const reached = ratio(schemeValue(tokens, role, scheme), surface);
          assert.ok(reached >= 4.5, `${tint} ${scheme}: ${role} on ${surface} is ${reached.toFixed(2)}`);
        }
      }
    }
  }
});

test("the tint keeps the lightness steps of the default palette", () => {
  for (const tint of Object.values(TINTS)) {
    const tokens = brandTokens({ neutral: tint });
    for (const scheme of ["light", "dark"] as const) {
      for (const role of ["canvas", "surface", "surface-raised", "border", "border-strong"]) {
        const derived = toOklch(schemeValue(tokens, `color-${role}`, scheme));
        const original = toOklch(DEFAULT_COLORS[scheme][role as keyof (typeof DEFAULT_COLORS)[typeof scheme]]);
        assert.ok(derived !== undefined && original !== undefined);
        // Rounded hex loses a little lightness, and the near-white raised surface cannot hold chroma at L=1.
        assert.ok(Math.abs(derived.l - original.l) <= 0.006, `${tint} ${scheme} ${role}: ${derived.l} vs ${original.l}`);
      }
    }
  }
});

test("the tint carries its hue into the surfaces, and a grey tint stays grey", () => {
  const warm = brandTokens({ neutral: TINTS.warm });
  const cool = brandTokens({ neutral: TINTS.cool });
  const grey = brandTokens({ neutral: TINTS.grey });
  for (const scheme of ["light", "dark"] as const) {
    const warmCanvas = toOklch(schemeValue(warm, "color-canvas", scheme));
    const coolCanvas = toOklch(schemeValue(cool, "color-canvas", scheme));
    const greyCanvas = toOklch(schemeValue(grey, "color-canvas", scheme));
    assert.ok(warmCanvas !== undefined && coolCanvas !== undefined && greyCanvas !== undefined);
    assert.ok(warmCanvas.c > 0.002, "a warm tint leaves chroma in the canvas");
    assert.ok(coolCanvas.h > 180 && coolCanvas.h < 300, `a cool tint keeps its blue hue, got ${coolCanvas.h}`);
    assert.ok(greyCanvas.c < 0.001, "a grey tint adds no chroma");
  }
});

test("a brand without a tint leaves the neutral palette to the theme", () => {
  assert.equal(Object.keys(brandTokens({})).length, 0);
  assert.ok(!Object.keys(brandTokens({ accent: "#2f6f9f" })).some((name) => name.startsWith("color-canvas")));
  assert.ok(!Object.keys(brandTokens({ radius: "large" })).some((name) => name.startsWith("color-")));
});
