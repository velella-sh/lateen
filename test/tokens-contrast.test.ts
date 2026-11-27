import assert from "node:assert/strict";
import { test } from "node:test";
import { CONTRAST_PAIRS, contrastFailures, loadTokens, type Tokens } from "../scripts/tokens.ts";

test("every text pair reaches 4.5:1 and every control edge 3:1, in light and dark (#1291)", () => {
  assert.deepEqual(contrastFailures(loadTokens()), []);
});

test("the brand roles and the method tones exist (#1291)", () => {
  const tokens = loadTokens();
  for (const name of ["brand", "brand-hover", "brand-subtle", "on-brand"]) assert.ok(tokens.get(`color-${name}`)?.dark, `color-${name} needs a dark value`);
  for (const method of ["get", "post", "put", "patch", "delete"]) {
    for (const part of ["bg", "fg"]) assert.ok(tokens.get(`state-method-${method}-${part}`)?.dark, `state-method-${method}-${part}`);
  }
  const checked = new Set(CONTRAST_PAIRS.flatMap(([fg, bg]) => [fg, bg]));
  for (const method of ["get", "post", "put", "patch", "delete"]) assert.ok(checked.has(`state-method-${method}-fg`), `${method} tone is not contrast-checked`);
});

test("the contrast check names a failing pair and the scheme (#1291)", () => {
  const tokens: Tokens = new Map([
    ["color-text", { light: "#777777", dark: "#ffffff" }],
    ["color-canvas", { light: "#888888", dark: "#000000" }],
  ]);
  const failures = contrastFailures(tokens);
  assert.ok(failures.some((line) => line.includes("color-text on color-canvas in light")));
  assert.ok(!failures.some((line) => line.includes("in dark")));
});

test("a pair that resolves through a reference is still checked (#1291)", () => {
  const tokens: Tokens = new Map([
    ["color-text", { light: "{color.canvas}", dark: "#ffffff" }],
    ["color-canvas", { light: "#ffffff", dark: "#000000" }],
  ]);
  assert.ok(contrastFailures(tokens).some((line) => line.includes("in light")));
});
