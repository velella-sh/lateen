// The release decisions are pure, so the whole first-publish/retry state machine is table-driven
// here instead of only on a real tag: dist-tag choice, first publish, partial publish, retry after
// a transient failure, retry exhaustion, and existing npm versions and GitHub Releases.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import type { ReleaseState } from "../scripts/release-plan.ts";
import { TAG_PATTERN, alreadyPublished, distTagOf, planOutputs, releaseOutcome, tagProblems } from "../scripts/release-plan.ts";

const release = (overrides: Partial<ReleaseState> = {}): ReleaseState => ({
  version: "0.2.3",
  served: "",
  tagExists: true,
  acceptance: "success",
  publish: "success",
  postPublish: "success",
  releaseExists: false,
  ...overrides,
});

test("dist-tag selection: prereleases go to next, stable versions to latest", () => {
  const cases = [
    ["0.2.3", "latest"],
    ["1.0.0", "latest"],
    ["1.0.0+build.5", "latest"],
    ["0.3.0-rc.1", "next"],
    ["1.0.0-beta.2", "next"],
  ] as const;
  for (const [version, expected] of cases) assert.equal(distTagOf(version), expected, version);
});

test("npm serving the exact version is the only retry signal", () => {
  const cases: readonly (readonly [string, boolean])[] = [
    ["", false],
    ["   ", false],
    ["0.2.2", false],
    ["0.2.30", false],
    ["0.2.3", true],
    ["0.2.3\n", true],
  ];
  for (const [served, expected] of cases) assert.equal(alreadyPublished(served, "0.2.3"), expected, served);
});

test("first publish with no npm tag and no dist-tag publishes, verifies and creates the release", () => {
  const outcome = releaseOutcome(release());
  assert.deepEqual(outcome, {
    distTag: "latest",
    firstPublish: true,
    verified: true,
    action: "create",
    reason: "verified; create the GitHub Release",
  });
  // First publish implies the publish job runs: no already-served version to verify.
  assert.deepEqual(planOutputs("0.2.3", ""), [
    "version=0.2.3",
    "dist-tag=latest",
    "published=false",
    "publish=true",
    "prerelease=false",
  ]);
});

test("a prerelease first publish selects the next dist-tag and a prerelease GitHub Release", () => {
  const outcome = releaseOutcome(release({ version: "0.3.0-rc.1" }));
  assert.equal(outcome.distTag, "next");
  assert.equal(outcome.verified, true);
  assert.deepEqual(planOutputs("0.3.0-rc.1", "").slice(1, 5), [
    "dist-tag=next",
    "published=false",
    "publish=true",
    "prerelease=true",
  ]);
});

test("an existing GitHub Release is a success, not a second release", () => {
  for (const version of ["0.2.3", "0.3.0-rc.1"]) {
    const outcome = releaseOutcome(release({ version, releaseExists: true }));
    assert.equal(outcome.verified, true, version);
    assert.equal(outcome.action, "exists", version);
  }
});

test("a tag that does not name this commit cannot produce a verified release", () => {
  const outcome = releaseOutcome(release({ tagExists: false }));
  assert.equal(outcome.verified, false);
  assert.equal(outcome.action, "none");
});

test("a partial publish (npm already serves the version) verifies without publishing", () => {
  const outcome = releaseOutcome(release({ served: "0.2.3", publish: "skipped" }));
  assert.equal(outcome.firstPublish, false);
  assert.equal(outcome.verified, true);
  assert.equal(outcome.action, "create");
  assert.deepEqual(planOutputs("0.2.3", "0.2.3\n").slice(2, 5), [
    "published=true",
    "publish=false",
    "prerelease=false",
  ]);
});

test("a retry after a transient publish failure stays unverified, then succeeds on the retry", () => {
  const failed = release({ publish: "failure", postPublish: "skipped" });
  assert.equal(releaseOutcome(failed).verified, false);
  assert.equal(releaseOutcome(failed).action, "none");

  // The retry sees the version on npm: publish is skipped, verification runs, the release is new.
  const retried = release({ served: "0.2.3", publish: "skipped" });
  assert.equal(releaseOutcome(retried).verified, true);
  assert.equal(releaseOutcome(retried).action, "create");
});

test("retry exhaustion never produces a verified release", () => {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const exhaustion = release({ publish: "failure" });
    const outcome = releaseOutcome(exhaustion);
    assert.equal(outcome.verified, false, `attempt ${attempt}`);
    assert.equal(outcome.action, "none", `attempt ${attempt}`);
  }
});

test("a post-publish acceptance failure leaves the release uncreated, even though npm serves it", () => {
  const outcome = releaseOutcome(release({ served: "0.2.3", publish: "skipped", postPublish: "failure" }));
  assert.equal(outcome.verified, false);
  assert.equal(outcome.action, "none");
});

test("a failed acceptance gate or publish job never verifies, whatever else passed", () => {
  const cases: readonly (readonly [string, Partial<ReleaseState>])[] = [
    ["acceptance failed", { acceptance: "failure" }],
    ["acceptance skipped", { acceptance: "skipped" }],
    ["publish failed on first publish", { publish: "failure" }],
    ["publish failed for an existing version", { served: "0.2.3", publish: "failure" }],
    ["first publish skipped publishing", { publish: "skipped" }],
    ["post-publish skipped", { served: "0.2.3", publish: "skipped", postPublish: "skipped" }],
  ];
  for (const [name, overrides] of cases) {
    const outcome = releaseOutcome(release(overrides));
    assert.equal(outcome.verified, false, name);
    assert.equal(outcome.action, "none", name);
  }
});

test("no combination of job results can claim a release the transitions did not verify", () => {
  const stages = ["success", "failure", "skipped"] as const;
  for (const served of ["", "0.2.3"]) {
    for (const tagExists of [true, false]) {
      for (const acceptance of stages) {
        for (const publish of stages) {
          for (const postPublish of stages) {
            for (const releaseExists of [true, false]) {
              const state = release({ served, tagExists, acceptance, publish, postPublish, releaseExists });
              const outcome = releaseOutcome(state);
              const label = JSON.stringify(state);
              const expected = tagExists && acceptance === "success" && postPublish === "success"
                && (served === "0.2.3" ? publish !== "failure" : publish === "success");
              assert.equal(outcome.verified, expected, label);
              if (outcome.verified) {
                assert.ok(outcome.action === "create" || outcome.action === "exists", label);
                assert.equal(outcome.action === "exists", releaseExists, label);
              } else {
                assert.equal(outcome.action, "none", label);
              }
            }
          }
        }
      }
    }
  }
});

// Tag validation from the preflight helper (#888), kept beside the state-machine tables.
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

test("an empty --served is a first publish, not a missing flag", () => {
  const dir = mkdtempSync(join(tmpdir(), "lateen-served-"));
  const output = join(dir, "github-output");
  try {
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "@velella/lateen", version: "0.2.3" }));
    writeFileSync(output, "");
    const result = spawnSync(process.execPath, [script, "--tag", "v0.2.3", "--served", "", "--github-output", output], {
      cwd: dir,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    const lines = readFileSync(output, "utf8");
    assert.match(lines, /published=false/);
    assert.match(lines, /publish=true/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
