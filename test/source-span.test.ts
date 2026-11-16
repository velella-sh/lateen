import assert from "node:assert/strict";
import { test } from "node:test";
import { locationOf, parseSpan } from "../src/source-span.ts";

test("a full span reads its file, start, and inclusive end", () => {
  assert.deepEqual(parseSpan("docs/guide/install.md:3:1-9:12"), {
    file: "docs/guide/install.md",
    line: 3,
    column: 1,
    endLine: 9,
    endColumn: 12,
  });
});

test("point forms end where they start, and a path may hold colons", () => {
  assert.deepEqual(parseSpan("a.md:7"), { file: "a.md", line: 7, column: 1, endLine: 7, endColumn: 1 });
  assert.deepEqual(parseSpan("a.md:7:4"), { file: "a.md", line: 7, column: 4, endLine: 7, endColumn: 4 });
  assert.equal(parseSpan("C:/docs/a.md:2:1-3:1")?.file, "C:/docs/a.md");
});

test("a malformed value is rejected, not guessed", () => {
  for (const bad of ["", "a.md", ":3", "a.md:0", "a.md:1:0", "a.md:5:1-4:1", "a.md:2:9-2:3", "a.md:-1"]) {
    assert.equal(parseSpan(bad), undefined, bad);
  }
  for (const bad of [undefined, null, 3, {}]) assert.equal(parseSpan(bad), undefined);
});

test("locationOf names the file and first line", () => {
  assert.equal(locationOf(parseSpan("docs/a.md:3:1-9:12")!), "docs/a.md:3");
});
