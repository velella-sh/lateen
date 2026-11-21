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
    'node --test --test-reporter=spec --test-reporter-destination=stdout --test-reporter=./scripts/test-report.ts --test-reporter-destination=stdout "test/**/*.test.ts"',
    "npm run test:redesign",
  ]) {
    assert.equal(run?.split(gate).length, 2, `the test script runs ${gate} exactly once`);
  }
});

// Main runs `npm run test:coverage` in place of `npm test` (see .github/workflows/ci.yml), so the
// coverage variant has to run every gate the plain suite runs. A gate added to one and not the other
// would leave main checked less than a pull request.
test("test:coverage runs every gate npm test runs, plus the coverage report", () => {
  const run = pkg.scripts["test:coverage"] ?? "";
  for (const gate of [
    "node scripts/tokens.ts --check",
    "node scripts/check-design.ts",
    'node --test --experimental-test-coverage --test-coverage-exclude="test/**" --test-coverage-exclude="scripts/**"',
    '"test/**/*.test.ts"',
    "npm run test:redesign",
    "npm run coverage:badge",
  ]) {
    assert.equal(run.split(gate).length, 2, `test:coverage runs ${gate} exactly once`);
  }
  assert.ok(
    run.includes("--test-reporter=lcov --test-reporter-destination=coverage/lcov.info"),
    "test:coverage writes the lcov report the badge reads",
  );
  assert.ok(run.includes("--test-reporter=spec"), "test:coverage prints the spec report");
});
