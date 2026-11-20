// A release dispatch input is arbitrary text: the tag must be one bare `v<version>` ref that names
// the package.json version, so a branch, a full ref, a range or shell syntax stops before checkout.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { TAG_PATTERN, tagProblems } from "../scripts/release-plan.ts";

const script = fileURLToPath(new URL("../scripts/release-plan.ts", import.meta.url));

test("a stable or prerelease tag that names the package version is valid", () => {
  for (const [tag, version] of [
    ["v0.2.3", "0.2.3"],
    ["v1.0.0", "1.0.0"],
    ["v0.3.0-rc.1", "0.3.0-rc.1"],
    ["v1.0.0-beta.2", "1.0.0-beta.2"],
  ] as const) {
    assert.deepEqual(tagProblems(tag, version), [], tag);
  }
});

test("malformed and ambiguous refs name every reason", () => {
  for (const tag of ["0.2.3", "v0.2", "v0.2.3.4", "refs/tags/v0.2.3", "v0.2.3^{}", "v0.2.3..main", "v0.2.3 ", "main", "v0.2.3/extra", "v00.2.3"]) {
    const problems = tagProblems(tag, "0.2.3");
    assert.match(problems.join("\n"), /the release tag must be exactly/, tag);
  }
});

test("a tag whose version is not the package version is refused", () => {
  assert.match(tagProblems("v0.2.4", "0.2.3").join("\n"), /does not match package\.json version 0\.2\.3/);
  assert.match(tagProblems("v0.2.3", "02.3").join("\n"), /is not a release version/);
});

test("the helper's pattern is the one shape the workflow preflight checks", () => {
  const workflow = readFileSync(new URL("../.github/workflows/release.yml", import.meta.url), "utf8");
  assert.ok(workflow.includes(TAG_PATTERN), "the preflight shell check and the helper agree");
});

/** Runs the CLI in a temporary package checkout and returns its status, stdout, stderr and outputs. */
function cli(tag: string, version = "0.2.3") {
  const dir = mkdtempSync(join(tmpdir(), "lateen-tag-"));
  const output = join(dir, "github-output");
  try {
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "@velella/lateen", version }));
    writeFileSync(output, "");
    const result = spawnSync(process.execPath, [script, "--tag", tag, "--github-output", output], { cwd: dir, encoding: "utf8" });
    return { status: result.status, stdout: result.stdout, stderr: result.stderr, outputs: readFileSync(output, "utf8") };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("the CLI writes the version for a valid tag", () => {
  const result = cli("v0.2.3");
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.outputs, "version=0.2.3\n");
});

test("the CLI refuses a malformed tag and writes no output", () => {
  const result = cli("refs/heads/main");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /the release tag must be exactly/);
  assert.equal(result.outputs, "");
});
