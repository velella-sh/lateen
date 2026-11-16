import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const css = readFileSync(new URL("../layouts/home.css", import.meta.url), "utf8");
const entrance = css.slice(css.indexOf("@supports (animation-timeline"));

/** The text of the first block after `start`, with braces balanced. */
function block(source: string, start: number): string {
  const open = source.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    if (source[i] === "}") depth -= 1;
    if (depth === 0) return source.slice(open + 1, i);
  }
  throw new Error("unbalanced block");
}

test("the scroll entrance sits inside the animation-timeline feature query", () => {
  assert.ok(css.includes("@supports (animation-timeline: view())"));
  const outside = css.slice(0, css.indexOf("@supports (animation-timeline"));
  assert.doesNotMatch(outside, /animation-timeline|home-showpiece-enter/);
  const inside = block(css, css.indexOf("@supports (animation-timeline"));
  assert.match(inside, /animation-timeline: view\(\)/);
  assert.match(inside, /@keyframes home-showpiece-enter/);
});

test("the entrance runs only without a reduced-motion preference and is switched off for reduce, print and forced colours", () => {
  const inside = block(entrance, 0);
  const run = inside.indexOf("@media (prefers-reduced-motion: no-preference)");
  assert.ok(run >= 0);
  assert.match(block(inside, run), /animation-timeline: view\(\)/);
  const off = inside.indexOf("@media (prefers-reduced-motion: reduce), print, (forced-colors: active)");
  assert.ok(off >= 0);
  assert.match(block(inside, off), /animation: none/);
});

test("the resting state is the final state: no hidden content outside the animation", () => {
  const rest = css.slice(0, css.indexOf("@supports (animation-timeline"));
  assert.doesNotMatch(rest, /opacity:\s*0\s*;/);
  assert.doesNotMatch(rest, /visibility:\s*hidden/);
  const keyframes = block(entrance, entrance.indexOf("@keyframes"));
  assert.match(keyframes.slice(keyframes.indexOf("to")), /opacity: 1/);
});

test("the entrance adds no script", () => {
  const source = readFileSync(new URL("../layouts/home.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /client\.ts|<script|IntersectionObserver/);
});
