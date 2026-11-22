// The main-only coverage path cannot be exercised by a pull request's CI: a pull request never takes
// the `Test with coverage` step and never runs the coverage job. These tests parse ci.yml so that a
// change which breaks that path fails on the pull request instead of on the first push to main, and
// so that the redundant full suite (or a second UI build) cannot come back unnoticed.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parse } from "yaml";

interface Step {
  readonly name?: string;
  readonly id?: string;
  readonly uses?: string;
  readonly if?: string;
  readonly run?: string;
  readonly with?: Record<string, unknown>;
  readonly env?: Record<string, unknown>;
}

interface Job {
  readonly name?: string;
  readonly needs?: string | readonly string[];
  readonly if?: string;
  readonly permissions?: Record<string, string>;
  readonly steps: readonly Step[];
}

const source = readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");
const workflow = parse(source) as {
  permissions?: Record<string, string>;
  jobs: Record<string, Job>;
};

/** The one condition a main push satisfies; every main-only step and job spells it the same way. */
const MAIN = "github.event_name == 'push' && github.ref == 'refs/heads/main'";

const job = (name: string): Job => {
  const found = workflow.jobs[name];
  assert.ok(found, `the ci workflow has a ${name} job`);
  return found;
};

const needsOf = (name: string): readonly string[] => {
  const needs = job(name).needs ?? [];
  return typeof needs === "string" ? [needs] : needs;
};

const stepNamed = (jobName: string, name: string): Step => {
  const found = job(jobName).steps.find((step) => step.name === name);
  assert.ok(found, `${jobName} has a ${name} step`);
  return found;
};

const stepsUsing = (jobName: string, action: string): readonly Step[] =>
  job(jobName).steps.filter((step) => step.uses?.startsWith(`${action}@`));

test("every required check keeps its job name", () => {
  for (const name of ["test", "performance-compare", "a11y", "smoke", "visual", "coverage"]) {
    assert.ok(workflow.jobs[name], `the ${name} check still exists`);
  }
  // The coverage job is the required check name, so its display name stays `coverage`.
  assert.equal(job("coverage").name, "coverage");
});

test("a push to main runs the coverage variant instead of a second full suite", () => {
  const covered = stepNamed("test", "Test with coverage");
  assert.equal(covered.if, MAIN, "only a push to main measures coverage");
  assert.equal(covered.run, "npm run test:coverage");

  const plain = stepNamed("test", "Test");
  assert.equal(plain.run, "npm test");
  assert.ok(plain.if, "the plain suite is conditional, so main does not run both");
  // Exactly the complement of the main condition: a manual dispatch of main runs `npm test` rather
  // than neither step, which a bare negation of the push event would have caused.
  assert.equal(plain.if, "github.event_name != 'push' || github.ref != 'refs/heads/main'");
});

test("the test job uploads the coverage report it measured on main", () => {
  const upload = stepsUsing("test", "actions/upload-artifact").find((step) => step.with?.name === "coverage");
  assert.ok(upload, "the test job uploads a coverage artifact");
  assert.equal(upload.if, MAIN);
  assert.equal(upload.with?.path, "lateen/coverage/coverage.json");
});

test("the coverage job publishes the artifact instead of measuring the suite again", () => {
  const coverage = job("coverage");
  assert.deepEqual(needsOf("coverage"), ["test"], "the badge waits for the suite that measured it");
  assert.equal(coverage.if, MAIN, "the badge stays main-only");
  // Nothing to check out, install, or build: the only input is the uploaded report.
  assert.deepEqual(stepsUsing("coverage", "actions/checkout"), []);
  assert.equal(
    coverage.steps.some((step) => /test:coverage|npm ci|npm run|ui:build/.test(step.run ?? "")),
    false,
    "the coverage job runs no repository script",
  );
  const download = stepsUsing("coverage", "actions/download-artifact");
  assert.equal(download.length, 1, "the coverage job downloads the report");
  assert.equal(download[0]?.with?.name, "coverage");
  assert.equal(download[0]?.with?.path, "coverage");
  const publish = stepNamed("coverage", "Publish the badge");
  assert.match(publish.run ?? "", /cp "\$GITHUB_WORKSPACE\/coverage\/coverage\.json" coverage\.json/);
  assert.match(publish.run ?? "", /git push --force /);
});

test("only the badge job may write repository contents", () => {
  const writers = Object.keys(workflow.jobs).filter((name) => job(name).permissions?.contents === "write");
  assert.deepEqual(writers, ["coverage"]);
  assert.deepEqual(workflow.permissions, { contents: "read" });
  assert.equal(job("test").permissions, undefined, "the test job keeps the workflow's read-only default");
});

test("every action is pinned to a commit", () => {
  for (const name of Object.keys(workflow.jobs)) {
    for (const step of job(name).steps) {
      const uses = step.uses ?? "";
      if (!uses || uses.startsWith("./")) continue; // the repository's own composite action
      assert.match(uses, /^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/, `${name}/step ${step.name ?? uses} is not pinned`);
    }
  }
  // A version comment, so a reader can tell which release the commit is.
  assert.match(source, /actions\/download-artifact@[0-9a-f]{40} # v\d+\.\d+\.\d+\n/);
});

test("a step that already built the UI is not preceded by a second build", () => {
  // `npm run test:a11y` and `npm run test:smoke` each build the UI in this job's workspace, so the
  // steps that follow run their script directly.
  assert.match(stepNamed("a11y", "Accessibility gate").run ?? "", /npm run test:a11y/);
  assert.equal(stepNamed("a11y", "Screen-reader path audit").run, "node scripts/audit-screen-reader.ts");
  assert.match(stepNamed("smoke", "Browser smoke gate").run ?? "", /npm run test:smoke/);
  assert.equal(
    stepNamed("smoke", "Mobile search opening budget").run,
    "node scripts/search-open-budget.ts --report test/smoke/out/search-open.json",
  );
});

test("the gates that must not weaken are still in the workflow", () => {
  // A clean-checkout install and package smoke, the label gate for baselines, and the fixtures.
  assert.equal(stepNamed("test", "Build the packages and install them").run, "scripts/smoke-package.sh");
  assert.match(stepNamed("visual", "Require the visual-change label for baseline edits").run ?? "", /visual-change/);
  assert.equal(stepNamed("test", "Component fixture inventory").run, "node --test test/visual/inventory.test.ts");
});

test("only a prose-only pull request skips the heavy gates, and the test job never skips", () => {
  const jobs = workflow.jobs as Record<string, Job>;
  for (const name of ["a11y", "smoke", "visual", "performance-compare"]) {
    const job = jobs[name] as Job;
    assert.deepEqual([job.needs].flat(), ["changes"], `${name} waits for the changes job`);
    assert.match(job.if ?? "", /needs\.changes\.outputs\.code == 'true'/, `${name} runs only when code changed`);
  }
  assert.equal((jobs["test"] as Job).if, "${{ !cancelled() }}", "the test job runs for every change, even when the changes job fails");
  assert.match(source, /\[ "\$EVENT" != "pull_request" \]; then echo "code=true"/, "pushes and manual runs run everything");
});

test("record-baselines records on the pinned runner, refuses main and commits only baselines", () => {
  const text = readFileSync(new URL("../.github/workflows/record-baselines.yml", import.meta.url), "utf8");
  const recorder = parse(text) as { on: Record<string, unknown>; jobs: Record<string, Job & { "runs-on"?: string }> };
  const job = recorder.jobs["record"] as Job & { "runs-on"?: string };
  assert.deepEqual(Object.keys(recorder.on), ["workflow_dispatch", "pull_request"]);
  assert.equal(job["runs-on"], "ubuntu-24.04");
  assert.match(job.if ?? "", /refs\/heads\/main/);
  assert.match(text, /test-visual\.ts --update/);
  assert.match(text, /git add -A test\/visual\/baselines/);
});

test("the label starts a same-repository recording and the recorder starts CI itself", () => {
  const text = readFileSync(new URL("../.github/workflows/record-baselines.yml", import.meta.url), "utf8");
  assert.match(text, /types: \[labeled\]/);
  assert.match(text, /github\.event\.label\.name == 'record-baselines'/);
  assert.match(text, /head\.repo\.full_name == github\.repository/, "a fork never gets a write token run");
  assert.match(text, /gh workflow run ci\.yml --ref/);
});

test("performance-compare allows the budget's 256 B of gzip noise", () => {
  assert.match(stepNamed("performance-compare", "Compare").run ?? "", /--tolerance 256 /);
});

test("the acceptance gate runs inside the smoke job, even after a smoke failure", () => {
  assert.equal(workflow.jobs["acceptance"], undefined);
  const gate = stepNamed("smoke", "Acceptance gate");
  assert.equal(gate.run, "npm run test:acceptance");
  assert.match(gate.if ?? "", /!cancelled\(\)/);
});
