// The release workflow's decisions are pure: which dist-tag a version takes, whether a tag may
// release it, and whether a run publishes or verifies an already-published version. A dispatch
// input is arbitrary text, so only one bare `v<version>` ref that names package.json is accepted.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { TAG_PATTERN, alreadyPublished, distTagOf, outputLines, planRelease, tagProblems } from "../scripts/release-plan.ts";

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
    assert.match(tagProblems(tag, "0.2.3").join("\n"), /the release tag must be exactly/, tag);
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

test("a prerelease version goes to next, a stable version to latest", () => {
  for (const [version, expected] of [
    ["0.2.3", "latest"],
    ["1.0.0", "latest"],
    ["1.0.0+build.5", "latest"],
    ["0.3.0-rc.1", "next"],
    ["1.0.0-beta.2", "next"],
  ] as const) {
    assert.equal(distTagOf(version), expected, version);
  }
});

test("a version npm already serves is a retry, not a first publish", () => {
  for (const [served, version, expected] of [
    ["", "0.2.3", false],
    ["   ", "0.2.3", false],
    ["0.2.2", "0.2.3", false],
    ["0.2.3", "0.2.3", true],
    ["0.2.3\n", "0.2.3", true],
  ] as const) {
    assert.equal(alreadyPublished(served, version), expected, served);
  }
});

test("the plan is table-driven across first publish, stable, prerelease and retry", () => {
  const cases = [
    { served: "", version: "0.2.3", distTag: "latest", published: false, publish: true, prerelease: false, latest: true },
    { served: "0.2.3", version: "0.2.3", distTag: "latest", published: true, publish: false, prerelease: false, latest: true },
    { served: "", version: "0.3.0-rc.1", distTag: "next", published: false, publish: true, prerelease: true, latest: false },
    { served: "0.3.0-rc.1", version: "0.3.0-rc.1", distTag: "next", published: true, publish: false, prerelease: true, latest: false },
  ] as const;
  for (const { served, version, ...expected } of cases) assert.deepEqual(planRelease(version, served), { version, ...expected });
});

test("the workflow outputs name every decision", () => {
  assert.deepEqual(outputLines(planRelease("0.3.0-rc.1", "")), [
    "version=0.3.0-rc.1",
    "dist-tag=next",
    "published=false",
    "publish=true",
    "prerelease=true",
    "latest=false",
  ]);
});

/** Runs the CLI in a temporary package checkout and returns its status, stdout, stderr and outputs. */
function cli(tag: string, served = "", version = "0.2.3") {
  const dir = mkdtempSync(join(tmpdir(), "lateen-plan-"));
  const output = join(dir, "github-output");
  const summary = join(dir, "github-summary");
  try {
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "@velella/lateen", version }));
    writeFileSync(output, "");
    writeFileSync(summary, "");
    const result = spawnSync(process.execPath, [script, "--tag", tag, "--served", served, "--github-output", output], {
      cwd: dir,
      encoding: "utf8",
      env: { ...process.env, GITHUB_STEP_SUMMARY: summary },
    });
    return { status: result.status, stdout: result.stdout, stderr: result.stderr, outputs: readFileSync(output, "utf8"), summary: readFileSync(summary, "utf8") };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("the CLI writes the plan and the summary, and a retry turns publish off", () => {
  const first = cli("v0.2.3");
  assert.equal(first.status, 0, first.stderr);
  assert.equal(first.outputs, "version=0.2.3\ndist-tag=latest\npublished=false\npublish=true\nprerelease=false\nlatest=true\n");
  assert.match(first.summary, /Releasing @velella\/lateen@0\.2\.3 to the `latest` dist-tag \(already on npm: false\)/);

  const retry = cli("v0.3.0-rc.1", "0.3.0-rc.1", "0.3.0-rc.1");
  assert.equal(retry.status, 0, retry.stderr);
  assert.match(retry.outputs, /dist-tag=next/);
  assert.match(retry.outputs, /published=true/);
  assert.match(retry.outputs, /publish=false/);
});

test("the CLI refuses a malformed tag and writes no output", () => {
  const result = cli("refs/heads/main");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /the release tag must be exactly/);
  assert.equal(result.outputs, "");
});

test("the CLI refuses a tag that does not match package.json", () => {
  const result = cli("v0.2.4");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /does not match package\.json version 0\.2\.3/);
  assert.equal(result.outputs, "");
});
