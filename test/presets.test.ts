// Every shipped preset keeps the brand roles readable in both schemes (#1295).
import assert from "node:assert/strict";
import { test } from "node:test";
import { contrast, parseHex } from "../src/color.ts";
import { brandTokens, presetNames, resolveBrand } from "../src/brand.ts";
import { DEFAULT_COLORS } from "../src/brand.ts";

const rgb = (value: string) => {
  const parsed = parseHex(value);
  assert.ok(parsed !== undefined, `${value} is a hex colour`);
  return parsed;
};

test("there are nine presets", () => {
  assert.equal(presetNames().length, 9);
});

for (const name of presetNames()) {
  test(`${name}: the brand roles keep their contrast in light and dark`, () => {
    const { brand } = resolveBrand({ preset: name });
    assert.ok(brand !== undefined);
    const tokens = brandTokens(brand);
    for (const scheme of ["light", "dark"] as const) {
      const pick = (role: string): string => {
        const value = tokens[`color-${role}`]?.[scheme] ?? (DEFAULT_COLORS[scheme] as Record<string, string>)[role];
        assert.ok(value !== undefined && /^#/.test(value), `${name} ${scheme} ${role} resolves to a hex`);
        return value;
      };
      const check = (fg: string, bg: string, wanted: number): void => {
        const ratio = contrast(rgb(pick(fg)), rgb(pick(bg)));
        assert.ok(ratio >= wanted, `${name} ${scheme}: ${fg} on ${bg} is ${ratio.toFixed(2)}:1, wanted ${wanted}`);
      };
      for (const bg of ["canvas", "surface", "surface-raised"]) check("brand", bg, 4.5);
      check("on-brand", "brand", 4.5);
      check("text", "brand-subtle", 4.5);
      check("brand", "brand-subtle", 4.5);
    }
  });
}
