// `npm test` must build the UI exactly once: the pretest hook builds, and the test script runs every
// gate without building again. A second build in the test script doubled the wait before any gate ran.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
  scripts: Record<string, string>;
};

test("npm test builds the UI once, in pretest, and runs every gate once", () => {
  const { pretest, test: run } = pkg.scripts;
  assert.equal(pretest, "npm run ui:build", "the pretest hook owns the one UI build");
  assert.equal(run?.includes("ui:build"), false, "the test script does not build the UI a second time");
  for (const gate of [
    "node scripts/tokens.ts --check",
    "node scripts/check-design.ts",
    'node --test "test/**/*.test.ts"',
    "npm run test:redesign",
  ]) {
    assert.equal(run?.split(gate).length, 2, `the test script runs ${gate} exactly once`);
  }
});