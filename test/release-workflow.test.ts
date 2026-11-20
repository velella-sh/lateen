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