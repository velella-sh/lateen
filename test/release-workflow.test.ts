// The release workflow's job graph is release correctness: the GitHub Release must not exist
// before the published package passed acceptance. These tests parse the workflow itself, so a
// change to a job's needs/if that breaks the chain fails here instead of on a release tag.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parse } from "yaml";

interface Step {
  readonly name?: string;
  readonly uses?: string;
  readonly if?: string;
  readonly run?: string;
}

interface Job {
  readonly needs?: string | readonly string[];
  readonly if?: string;
  readonly steps: readonly Step[];
}

const workflow = parse(readFileSync(new URL("../.github/workflows/release.yml", import.meta.url), "utf8")) as {
  jobs: Record<string, Job>;
};

const job = (name: string): Job => {
  const found = workflow.jobs[name];
  assert.ok(found, `the release workflow has a ${name} job`);
  return found;
};

const needsOf = (name: string): readonly string[] => {
  const needs = job(name).needs ?? [];
  return typeof needs === "string" ? [needs] : needs;
};

const ifOf = (name: string): string => job(name).if ?? "";

test("the GitHub Release depends on the post-publish acceptance job", () => {
  assert.ok(needsOf("github-release").includes("acceptance-published"));
  assert.ok(needsOf("acceptance-published").includes("publish"));
});

test("a first publish creates the GitHub Release only after post-publish acceptance passed", () => {
  // The publish-success shortcut is gone: only a passed acceptance-published run (or the
  // already-published retry path) may create the release.
  const condition = ifOf("github-release");
  assert.match(condition, /needs\['acceptance-published'\]\.result == 'success'/);
  assert.doesNotMatch(condition, /needs\.publish\.result == 'success'/);
  assert.match(condition, /needs\.acceptance\.result == 'success'/);
});

test("the post-publish acceptance job still requires a successful publish", () => {
  assert.match(ifOf("acceptance-published"), /needs\.publish\.result == 'success'/);
});

test("a retry runs the acceptance gate instead of skipping it", () => {
  // No acceptance step may be conditional on the version being unpublished: a retry needs fresh
  // acceptance evidence from the tagged commit to verify the published package against.
  for (const step of job("acceptance").steps) {
    assert.doesNotMatch(step.if ?? "", /published/, `acceptance step ${step.name ?? step.uses} skips work on a retry`);
  }
});

test("a retry verifies the already-published version before the GitHub Release", () => {
  const condition = ifOf("acceptance-published");
  assert.match(condition, /needs\.acceptance\.outputs\.published == 'true'/);
  assert.match(condition, /needs\.acceptance\.result == 'success'/);
  // The GitHub Release has no already-published bypass: the verified run is the only way in.
  assert.doesNotMatch(ifOf("github-release"), /published == 'true'/);
  const cases = job("acceptance-published").steps.find((step) => step.name === "Run the shipped cases against the npm package");
  assert.ok(cases?.run?.includes('--theme "@velella/lateen@$VERSION"'), "the retry installs the exact published version");
});

test("publish and digest steps select the one tarball the acceptance report names", () => {
  const step = (jobName: string, name: string): string => {
    const found = job(jobName).steps.find((item) => item.name === name);
    assert.ok(found?.run, `${jobName} has a ${name} step`);
    return found.run;
  };
  const gate = step("publish", "Require the acceptance report to pass");
  const publish = step("publish", "Publish the tested tarball with provenance");
  const digest = step("acceptance-published", "Prove the published tarball is the tested tarball");
  for (const run of [gate, publish]) {
    assert.ok(run.includes("node scripts/release-tarball.ts --dir ../acceptance --report ../acceptance/report.json"));
  }
  assert.ok(digest.includes("node scripts/release-tarball.ts --dir ../published --report ../acceptance/report.json"));
  // No shell glob may pick the tarball: zero or several .tgz files must stop the release.
  for (const jobName of ["publish", "acceptance-published"]) {
    for (const item of job(jobName).steps) {
      assert.doesNotMatch(item.run ?? "", /ls \.\.\/(acceptance|published)\/\*\.tgz/);
    }
  }
});