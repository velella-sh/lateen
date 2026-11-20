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
  readonly with?: Record<string, unknown>;
  readonly env?: Record<string, unknown>;
}

interface Job {
  readonly needs?: string | readonly string[];
  readonly if?: string;
  readonly environment?: { readonly name?: string } | string;
  readonly permissions?: Record<string, string>;
  readonly steps: readonly Step[];
}

const workflow = parse(readFileSync(new URL("../.github/workflows/release.yml", import.meta.url), "utf8")) as {
  permissions?: Record<string, string>;
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

test("a manual dispatch validates the tag before the tag is checked out", () => {
  // The dispatch input is arbitrary text: a malformed or fully qualified ref must stop before a
  // runner checks it out, and the helper copy must come from the default branch, not the tag.
  assert.ok(needsOf("acceptance").includes("preflight"), "acceptance waits for preflight");
  const preflight = job("preflight");
  const check = preflight.steps.find((step) => step.name === "Check the tag before checkout")?.run ?? "";
  assert.ok(check.includes('node scripts/release-plan.ts --tag "$TAG" --version "$version" --github-output "$GITHUB_OUTPUT"'));
  assert.ok(check.includes('git fetch --quiet --depth 1 origin "refs/tags/$TAG"'), "the tag must exist before it is checked out");
  assert.ok(check.includes('echo "commit=$commit" >> "$GITHUB_OUTPUT"'), "preflight names the commit it resolved");
  const helper = preflight.steps.find((step) => step.uses?.startsWith("actions/checkout"));
  const helperRef = helper?.with?.ref ?? "";
  assert.ok(helperRef.includes("github.event.repository.default_branch"), "preflight checks out a fixed ref");
  assert.doesNotMatch(helperRef, /refs\/tags/, "preflight never checks out the dispatched tag");

  // The tag checkout is the first acceptance step, and the version/dist-tag come from preflight.
  const first = job("acceptance").steps[0];
  assert.match(first?.with?.ref ?? "", /^refs\/tags\/\$\{\{ env\.TAG \}\}$/);
  const meta = job("acceptance").steps.find((step) => step.name === "Check the tag target and choose the dist-tag");
  assert.ok(meta?.run);
  assert.match(meta.run, /git rev-parse HEAD.*!=.*COMMIT/s, "a moved tag cannot release another commit");
  assert.doesNotMatch(meta.run, /require\('\.\/package\.json'\)\.version/, "acceptance does not recompute the tag version");
  assert.ok(meta.run.includes("git merge-base --is-ancestor HEAD origin/main"), "the main-ancestor check stays");
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

test("the post-publish acceptance report is uploaded as release evidence", () => {
  const upload = job("acceptance-published").steps.find((step) => step.with?.name === "acceptance-published");
  assert.ok(upload, "acceptance-published uploads its report");
  assert.equal(upload.with?.path, "published");
  // A run that never wrote a report fails the upload instead of passing with no evidence.
  assert.equal(upload.with?.["if-no-files-found"], "error");
  const retention = Number(upload.with?.["retention-days"]);
  assert.ok(retention > 0 && retention <= 30, `retention is bounded, got ${retention}`);
  // Running on failure is what preserves the evidence of a failed verification.
  assert.match(upload.if ?? "", /always\(\)/);
  // A distinct artifact name is what keeps it from overwriting the pre-publish evidence.
  const acceptance = job("acceptance").steps.find((step) => step.with?.name === "acceptance");
  assert.ok(acceptance);
  assert.notEqual(upload.with?.name, acceptance.with?.name);
});

// Permissions and credentials are least privilege too: a release job that gains a write scope or a
// usable token by accident must fail here, not on the tag.
const permissionsOf = (name: string): Record<string, string> => job(name).permissions ?? {};

const jobsWith = (scope: string, level: string): readonly string[] =>
  Object.keys(workflow.jobs).filter((name) => permissionsOf(name)[scope] === level);

const stepLabel = (jobName: string, step: Step): string => `${jobName}/${step.name ?? step.uses ?? "step"}`;

test("no job inherits the repository default permissions", () => {
  assert.deepEqual(workflow.permissions, {});
  for (const name of Object.keys(workflow.jobs)) {
    assert.ok(job(name).permissions, `${name} declares its own permissions`);
  }
});

test("only the publish job receives an OIDC token", () => {
  assert.deepEqual(jobsWith("id-token", "write"), ["publish"]);
  assert.deepEqual(permissionsOf("publish"), { contents: "read", "id-token": "write" });
});

test("only the GitHub Release job may write repository contents", () => {
  assert.deepEqual(jobsWith("contents", "write"), ["github-release"]);
  assert.deepEqual(permissionsOf("github-release"), { contents: "write" });
  for (const name of ["acceptance", "acceptance-published"]) {
    assert.deepEqual(permissionsOf(name), { contents: "read" });
  }
});

test("checkout never leaves the job token in the repository", () => {
  for (const name of Object.keys(workflow.jobs)) {
    for (const step of job(name).steps) {
      if (!step.uses?.startsWith("actions/checkout@")) continue;
      assert.equal(step.with?.["persist-credentials"], false, `${stepLabel(name, step)} persists credentials`);
    }
  }
});

test("the job token reaches only the GitHub Release step", () => {
  const holders: string[] = [];
  for (const name of Object.keys(workflow.jobs)) {
    for (const step of job(name).steps) {
      for (const [key, value] of Object.entries(step.env ?? {})) {
        if (!/TOKEN/.test(key)) continue;
        holders.push(stepLabel(name, step));
        // The workflow token, never a stored secret: trusted publishing needs no npm token.
        assert.equal(value, "${{ github.token }}", `${stepLabel(name, step)} receives ${key}`);
      }
    }
  }
  assert.deepEqual(holders, ["github-release/Create GitHub Release"]);
});

test("no step prints a credential or interpolates a secret", () => {
  for (const name of Object.keys(workflow.jobs)) {
    for (const step of job(name).steps) {
      const run = step.run ?? "";
      assert.doesNotMatch(run, /(echo|printf|cat|tee)[^\n]*(GH_TOKEN|GITHUB_TOKEN|NODE_AUTH_TOKEN|ACTIONS_ID_TOKEN)/, `${stepLabel(name, step)} prints a credential`);
      assert.doesNotMatch(run, /\$\{\{\s*secrets\./, `${stepLabel(name, step)} interpolates a secret`);
    }
  }
});

test("the publish job runs no repository script with its OIDC token", () => {
  for (const step of job("publish").steps) {
    assert.doesNotMatch(step.run ?? "", /npm run\s/, `${stepLabel("publish", step)} runs a repository script`);
  }
  for (const name of Object.keys(workflow.jobs)) {
    for (const step of job(name).steps) {
      if (/npm publish\b/.test(step.run ?? "") ) {
        assert.equal(name, "publish", `${stepLabel(name, step)} publishes`);
      }
    }
  }
  // Publishes the tarball the acceptance job packed, never the repository itself.
  const publish = job("publish").steps.find((step) => step.name === "Publish the tested tarball with provenance");
  assert.ok(publish?.run, "the publish step exists");
  assert.match(publish.run, /npm publish "\$tarball" --access public --provenance/);
  assert.doesNotMatch(publish.run, /npm publish\s*(--|$)/m);
});

test("the publish job is gated on acceptance evidence and the npm environment", () => {
  assert.ok(needsOf("publish").includes("acceptance"));
  assert.match(ifOf("publish"), /needs\.acceptance\.outputs\.published != 'true'/);
  const environment = job("publish").environment;
  assert.equal(typeof environment === "string" ? environment : environment?.name, "npm");
  const names = job("publish").steps.map((step) => step.name ?? step.uses ?? "");
  const gate = names.indexOf("Require the acceptance report to pass");
  assert.ok(gate >= 0, "the publish job runs the acceptance report gate");
  assert.ok(gate < names.indexOf("Publish the tested tarball with provenance"));
});