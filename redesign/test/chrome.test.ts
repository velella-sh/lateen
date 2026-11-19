import assert from "node:assert/strict";
import { test } from "node:test";
import { readingProgress, themeColor } from "../chrome/shell/client.ts";

test("themeColor maps sailcloth foam and night", () => {
  assert.equal(themeColor("light"), "#f4f4f9");
  assert.equal(themeColor("dark"), "#23212c");
});

test("readingProgress clamps between 0 and 1", () => {
  assert.equal(readingProgress(0, 100, 1000, 800), 0);
  assert.ok(readingProgress(500, 100, 1000, 800) > 0);
  assert.equal(readingProgress(5000, 100, 1000, 800), 1);
});
