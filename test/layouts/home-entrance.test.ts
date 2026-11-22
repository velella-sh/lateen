import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const css = "" /* lateen-legacy removed: layouts/home.css */;
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

test("the entrance adds no script", () => {
  const source = readFileSync(new URL("../../layouts/home.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /client\.ts|<script|IntersectionObserver/);
});
