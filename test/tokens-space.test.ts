import assert from "node:assert/strict";
import { test } from "node:test";
import { loadTokens } from "../scripts/tokens.ts";

const rem = (value: string | undefined): number => {
  const match = /^([\d.]+)rem$/.exec(value ?? "");
  assert.ok(match, `${value} is not a rem length`);
  return Number(match[1]);
};

test("the spacing ladder only grows (#1290)", () => {
  const tokens = loadTokens();
  const steps = [1, 2, 3, 4, 5, 6, 8, 12, 16].map((step) => rem(tokens.get(`space-${step}`)?.light));
  for (let index = 1; index < steps.length; index += 1) assert.ok((steps[index] ?? 0) > (steps[index - 1] ?? 0), `space step ${index} does not grow`);
});

test("the layout tokens exist and are ordered (#1290)", () => {
  const tokens = loadTokens();
  for (const name of ["header", "sidebar", "toc", "content", "content-wide", "gutter-compact", "gutter-sidebar", "gutter-toc", "gutter-page"]) {
    assert.ok(tokens.has(`space-${name}`), `space-${name} is missing`);
  }
  assert.ok(rem(tokens.get("space-content-wide")?.light) > rem(tokens.get("space-content")?.light), "the wide measure is wider than the content measure");
  const gutters = ["compact", "sidebar", "toc", "page"].map((name) => rem(tokens.get(`space-gutter-${name}`)?.light));
  for (let index = 1; index < gutters.length; index += 1) assert.ok((gutters[index] ?? 0) > (gutters[index - 1] ?? 0), "gutters grow with the breakpoint");
});

test("breakpoints are tokens, in increasing order, for container queries (#1290)", () => {
  const tokens = loadTokens();
  const order = ["compact", "sidebar", "toc", "page"].map((name) => rem(tokens.get(`breakpoint-${name}`)?.light));
  for (let index = 1; index < order.length; index += 1) assert.ok((order[index] ?? 0) > (order[index - 1] ?? 0), "breakpoints grow");
});
