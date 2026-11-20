// #920: the runner names its slow cases, and every test file builds into its own folder so two
// files can run at the same time without sharing output.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { slowCases } from "../scripts/test-report.ts";
import { root, tempDir } from "./integration-helpers.ts";

test("the report keeps only slow cases, slowest first and stable on ties", () => {
  const fast = { name: "fast", duration: 40 };
  const slowest = { name: "slowest", duration: 1200 };
  const b = { name: "b", duration: 900 };
  const a = { name: "a", duration: 900 };
  assert.deepEqual(slowCases([fast, b, slowest, a], 500), [slowest, a, b]);
});

test("two test files get separate output folders, so neither reads the other's output", () => {
  const first = tempDir("independent-output-");
  const second = tempDir("independent-output-");
  assert.notEqual(first, second);
  assert.ok(first.startsWith(tmpdir()), `${first} is a temporary folder`);
  assert.ok(!first.startsWith(root), `${first} is outside the checkout`);
  writeFileSync(join(first, "report.json"), "{}\n");
  assert.ok(existsSync(join(first, "report.json")));
  assert.ok(!existsSync(join(second, "report.json")), "the second folder stays empty");
});

test("the runner prints the slow cases of a real run", () => {
  const dir = tempDir("slow-report-probe-");
  const probe = join(dir, "probe.test.ts");
  writeFileSync(probe, 'import { test } from "node:test";\ntest("slow probe", () => {});\n');
  const env: Record<string, string | undefined> = { ...process.env, SLOW_TEST_MS: "0" };
  // The child must not inherit the running suite's test-runner context: with it, `node --test`
  // routes the run to the parent instead of this process's stdout.
  delete env["NODE_TEST_CONTEXT"];
  const run = spawnSync(
    process.execPath,
    ["--test", `--test-reporter=${join(root, "scripts/test-report.ts")}`, "--test-reporter-destination=stdout", probe],
    { encoding: "utf8", env },
  );
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^slow tests \(>= 0ms\):\n/);
  assert.match(run.stdout, /^ {2}[\d.]+ms {2}.*probe\.test\.ts > slow probe$/m);
});
