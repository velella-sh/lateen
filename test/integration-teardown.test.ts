// The integration helper's isolation contract (#867): every fixture is built in its own temporary
// directory, and the file's teardown removes the directories even when a test fails, so repeated
// runs leave no fixture output behind.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { root, tempDir } from "./integration-helpers.ts";

test("tempDir makes an isolated directory each call", () => {
  const first = tempDir("lateen-teardown-isolated-");
  const second = tempDir("lateen-teardown-isolated-");
  assert.notEqual(first, second, "two calls never share a working folder");
  assert.ok(existsSync(first));
  assert.ok(join(first, "left.md") !== join(second, "left.md"));
});

test("a failed test's temporary directories are still removed at teardown", () => {
  const probe = join(root, "test/integration-teardown-probe.ts");
  // The child must not inherit the running suite's test-runner context: with it, `node --test`
  // skips the file and the probe would not run at all.
  const env: Record<string, string | undefined> = { ...process.env, NODE_V8_COVERAGE: "" };
  delete env["NODE_TEST_CONTEXT"];
  const run = spawnSync(process.execPath, ["--test", probe], { encoding: "utf8", cwd: root, env });
  assert.notEqual(run.status, 0, "the probe test itself fails");
  assert.match(String(run.stderr) + String(run.stdout), /teardown must still remove/);
  assert.deepEqual(
    readdirSync(tmpdir()).filter((name) => name.startsWith("lateen-teardown-probe-")),
    [],
    "the failing probe leaves no fixture output behind",
  );
});
