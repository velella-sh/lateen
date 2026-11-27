import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { loadTokens, paths } from "../scripts/tokens.ts";

const LADDER = ["h1", "h2", "h3", "h4"];

/** The smallest size a step reaches: a plain rem, or the first argument of a clamp(). */
const floor = (value: string, tokens: ReturnType<typeof loadTokens>): number => {
  const ref = /^\{(.+)\}$/.exec(value);
  if (ref) return floor(tokens.get((ref[1] ?? "").replace(/\./g, "-"))?.light ?? "", tokens);
  const match = /^(?:clamp\()?([\d.]+)rem/.exec(value);
  assert.ok(match, `${value} has no rem floor`);
  return Number(match[1]);
};

test("each heading step is at least 1.2 times the next (#1289)", () => {
  const tokens = loadTokens();
  const sizes = LADDER.map((step) => floor(tokens.get(`type-${step}-size`)?.light ?? "", tokens));
  for (let index = 1; index < sizes.length; index += 1) {
    assert.ok((sizes[index - 1] ?? 0) / (sizes[index] ?? 1) >= 1.2, `${LADDER[index - 1]} is not 1.2 times ${LADDER[index]}`);
  }
  assert.ok(tokens.has("type-display-size"));
});

test("every heading step has a weight, leading, tracking and the space around it (#1289)", () => {
  const tokens = loadTokens();
  for (const step of ["display", ...LADDER]) for (const part of ["size", "weight", "leading", "tracking"]) assert.ok(tokens.has(`type-${step}-${part}`), `type-${step}-${part}`);
  for (const step of LADDER) for (const part of ["space-above", "space-below"]) assert.ok(tokens.has(`type-${step}-${part}`), `type-${step}-${part}`);
  assert.ok(tokens.has("type-desc-size") && tokens.has("type-desc-leading"));
});

test("Persian and Arabic pages get zero tracking on every heading step (#1289)", () => {
  const css = readFileSync(new URL("../styles/rtl.css", import.meta.url), "utf8");
  const root = css.slice(css.indexOf(":root:lang(fa),"), css.indexOf("}"));
  for (const step of ["display", ...LADDER]) assert.match(root, new RegExp(`--type-${step}-tracking:\\s*var\\(--rtl-letter-spacing\\)`), step);
  assert.match(readFileSync(paths.css, "utf8"), /--rtl-letter-spacing:\s*normal/);
  assert.match(css, /:root:lang\(fa\) \*,\s*:root:lang\(ar\) \*\s*\{\s*letter-spacing: var\(--rtl-letter-spacing\)/);
});
