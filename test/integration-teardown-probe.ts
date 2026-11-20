// A deliberately failing one-test file the integration teardown test runs in a child process:
// the temporary directory it makes through the shared helper must be removed by the file's
// teardown even though the test failed (#867). Not named `*.test.ts`, so the suite never runs it
// directly.
import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { test } from "node:test";
import { tempDir } from "./integration-helpers.ts";

const dir = tempDir("lateen-teardown-probe-");

test("the probe's directory exists while it runs, then the probe fails", () => {
  assert.ok(existsSync(dir), "the directory exists while the test runs");
  assert.ok(readdirSync(tmpdir()).some((name) => name.startsWith("lateen-teardown-probe-")));
  assert.fail("the probe always fails; teardown must still remove its directory");
});
