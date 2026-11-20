// The shared save-and-restore helper for the state a test borrows (#868): a test that mutates the
// environment, a global, the working directory or the exit code must not leak that state into the
// next test, whatever order the runner picks and whatever the test throws.
import assert from "node:assert/strict";
import { test } from "node:test";
import { setEnv, withEnv, withExitCode, withGlobal, withWorkingDirectory, type RestoreScope } from "./helpers/globals.ts";

/** A scope that collects its teardown hooks so a test can run them by hand. */
function scope(): RestoreScope & { run(): void } {
  const hooks: (() => void | Promise<void>)[] = [];
  return { after: (hook) => void hooks.push(hook), run: () => void hooks.splice(0).forEach((hook) => hook()) };
}

test("withEnv restores a set variable even when the body throws", () => {
  process.env.LATEEN_PROBE = "before";
  assert.throws(() => withEnv("LATEEN_PROBE", "during", () => {
    assert.equal(process.env.LATEEN_PROBE, "during");
    throw new Error("boom");
  }), /boom/);
  assert.equal(process.env.LATEEN_PROBE, "before");
  delete process.env.LATEEN_PROBE;
});

test("withEnv deletes a variable that was absent and brings it back absent", () => {
  delete process.env.LATEEN_PROBE;
  const seen = withEnv("LATEEN_PROBE", undefined, () => process.env.LATEEN_PROBE);
  assert.equal(seen, undefined);
  assert.ok(!("LATEEN_PROBE" in process.env));
  withEnv("LATEEN_PROBE", "during", () => {});
  assert.ok(!("LATEEN_PROBE" in process.env), "an absent variable stays absent afterwards");
});

test("setEnv holds the value for the rest of the run and restores it at the scope's teardown", () => {
  process.env.LATEEN_PROBE = "before";
  const probe = scope();
  setEnv("LATEEN_PROBE", "during", probe);
  assert.equal(process.env.LATEEN_PROBE, "during");
  probe.run();
  assert.equal(process.env.LATEEN_PROBE, "before");
  delete process.env.LATEEN_PROBE;
});

test("setEnv without a scope restores at the file's own teardown", () => {
  const probe = scope();
  setEnv("LATEEN_PROBE_SET", "value", probe);
  assert.equal(process.env.LATEEN_PROBE_SET, "value");
  probe.run();
  assert.ok(!("LATEEN_PROBE_SET" in process.env), "a variable that never existed is deleted again, not set to the text undefined");
});

test("withGlobal swaps a global property in and out, including one that never existed", () => {
  const original = globalThis.fetch;
  const fake = (() => "fake") as unknown as typeof fetch;
  const seen = withGlobal("fetch", fake, () => globalThis.fetch);
  assert.equal(seen, fake);
  assert.equal(globalThis.fetch, original);

  const never = withGlobal("LATEEN_PROBE_GLOBAL", 42, () => (globalThis as Record<string, unknown>).LATEEN_PROBE_GLOBAL);
  assert.equal(never, 42);
  assert.ok(!("LATEEN_PROBE_GLOBAL" in globalThis));
});

test("withGlobal restores the original even when the body throws", () => {
  const original = globalThis.fetch;
  assert.throws(
    () => withGlobal("fetch", (() => "fake") as unknown as typeof fetch, () => {
      throw new Error("boom");
    }),
    /boom/,
  );
  assert.equal(globalThis.fetch, original);
});

test("withWorkingDirectory returns to the caller's directory, also on failure", () => {
  const original = process.cwd();
  const tmp = withWorkingDirectory(process.env.TMPDIR ?? "/tmp", () => process.cwd());
  assert.notEqual(tmp, original);
  assert.equal(process.cwd(), original);
  assert.throws(() => withWorkingDirectory("/", () => {
    throw new Error("boom");
  }), /boom/);
  assert.equal(process.cwd(), original);
});

test("withExitCode reads the code a main left behind and clears the process's own", () => {
  const run = withExitCode(() => {
    process.exitCode = 3;
    return "ran";
  });
  assert.equal(run.result, "ran");
  assert.equal(run.code, 3);
  assert.equal(process.exitCode, undefined, "the test process's own exit code stays clean");
});
