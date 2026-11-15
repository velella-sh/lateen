// Corner radius and density are closed sets, never free-form lengths. The radius multiplies the
// shipped corner scale and leaves the full circle alone; the compact density scales the spacing
// rhythm but keeps the largest step at 24 CSS pixels, the minimum interactive target.
import assert from "node:assert/strict";
import { test } from "node:test";
import { brandTokens, DEFAULT_RADIUS, DEFAULT_SPACE, resolveBrand } from "../src/brand.ts";

const rem = (value: string): number => {
  const match = /^([\d.]+)rem$/.exec(value);
  assert.ok(match?.[1] !== undefined, `${value} is a rem length`);
  return Number(match[1]);
};

test("each radius value multiplies the shipped corners, and none squares them", () => {
  const expected: Record<string, Record<string, string>> = {
    none: { sm: "0rem", md: "0rem", lg: "0rem", ctl: "0rem", card: "0rem" },
    small: { sm: "0.125rem", md: "0.25rem", lg: "0.5rem", ctl: "0.1875rem", card: "0.3125rem" },
    medium: { sm: "0.25rem", md: "0.5rem", lg: "1rem", ctl: "0.375rem", card: "0.625rem" },
    large: { sm: "0.375rem", md: "0.75rem", lg: "1.5rem", ctl: "0.5625rem", card: "0.9375rem" },
  };
  for (const [radius, values] of Object.entries(expected)) {
    const tokens = brandTokens({ radius: radius as "none" });
    for (const [name, value] of Object.entries(values)) {
      assert.equal(tokens[`radius-${name}`]?.light, value, `${radius} ${name}`);
      assert.equal(tokens[`radius-${name}`]?.dark, value, "a radius has no scheme");
    }
  }
  assert.equal(brandTokens({ radius: "large" })["radius-full"], undefined, "a full circle stays a circle");
});

test("the compact density scales the rhythm and keeps a 24px target", () => {
  const tokens = brandTokens({ density: "compact" });
  for (const [name, value] of Object.entries(DEFAULT_SPACE)) {
    const compact = rem(tokens[`space-${name}`]?.light ?? "0rem");
    assert.ok(compact < rem(value), `space-${name} shrinks`);
    assert.ok(compact > 0, `space-${name} stays positive`);
  }
  assert.equal(tokens["space-8"]?.light, "1.5rem");
  assert.ok(rem(tokens["space-8"]?.light ?? "0rem") * 16 >= 24, "the largest step is at least 24px");
});

test("the comfortable density is the shipped scale", () => {
  const tokens = brandTokens({ density: "comfortable" });
  for (const [name, value] of Object.entries(DEFAULT_SPACE)) {
    assert.equal(tokens[`space-${name}`]?.light, value, `space-${name}`);
  }
  assert.deepEqual(Object.entries(DEFAULT_RADIUS).length, 5);
});

test("free-form lengths and unknown values are refused by name", () => {
  const result = resolveBrand({ brand: { radius: "7px", density: "airy" } });
  assert.equal(result.brand, undefined);
  assert.deepEqual(
    result.problems.map((problem) => problem.option),
    ["theme.options.brand.radius", "theme.options.brand.density"],
  );
  assert.match(result.problems[0]?.message ?? "", /none, small, medium, large/);
  assert.match(result.problems[1]?.message ?? "", /compact, comfortable/);
});
