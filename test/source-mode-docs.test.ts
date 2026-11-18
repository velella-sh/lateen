import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { SOURCE_MODE_OPTIONS } from "../chrome/source-mode/index.ts";

const page = readFileSync(new URL("../site/source-mode.md", import.meta.url), "utf8");

test("the source mode page documents every option the code reads, and no other", () => {
  const documented = [...page.matchAll(/^\| `([^`]+)`/gm)].map((match) => match[1]);
  assert.deepEqual(documented, [...SOURCE_MODE_OPTIONS]);
});

test("the source mode page covers the switch, the deep link, the no-script case and the editor schemes", () => {
  for (const phrase of ["Press <kbd>y</kbd>", "?source=<file>:<line>", "Without JavaScript", "vscode", "local storage"]) {
    assert.ok(page.includes(phrase), `the page does not mention ${phrase}`);
  }
  assert.match(page, /^## Live example$/m);
});
