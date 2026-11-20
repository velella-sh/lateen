import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { releaseNote, releaseResultOf } from "../scripts/release-result.ts";

const script = fileURLToPath(new URL("../scripts/release-result.ts", import.meta.url));
const run = "https://github.com/velella-sh/lateen/actions/runs/1";
const digest = "a".repeat(64);
const state = { tag: "v0.2.3", exists: true, run, accepted: digest, published: digest };

test("an existing release with a passed post-publish run and matching digests is verified", () => {
  assert.deepEqual(releaseResultOf(state), {
    tag: "v0.2.3",
    exists: true,
    evidence: { acceptance: run, published: run },
    tarball: { candidate: `sha256:${digest}`, published: `sha256:${digest}` },
    checks: { release: true, acceptance: true, digest: true },
    verified: true,
    problems: [],
  });
  assert.equal(
    releaseNote(releaseResultOf(state)),
    `Verified GitHub Release v0.2.3: post-publish acceptance passed in ${run}; the published tarball is sha256:${digest}.`,
  );
});

test("a missing release is unverified and every failed check is named", () => {
  const result = releaseResultOf({ ...state, exists: false });
  assert.equal(result.verified, false);
  assert.equal(result.checks.release, false);
  assert.deepEqual(result.problems, ["the GitHub Release v0.2.3 does not exist"]);
  assert.match(releaseNote(result), /is not verified/);
});

test("a digest mismatch or missing acceptance evidence is unverified", () => {
  const mismatch = releaseResultOf({ ...state, published: "b".repeat(64) });
  assert.equal(mismatch.verified, false);
  assert.deepEqual(mismatch.checks, { release: true, acceptance: true, digest: false });
  assert.match(mismatch.problems[0]!, /is not the accepted tarball digest/);

  const missing = releaseResultOf({ ...state, accepted: "" });
  assert.equal(missing.verified, false);
  assert.deepEqual(missing.problems, ["the post-publish run has no accepted tarball digest"]);

  const runMissing = releaseResultOf({ ...state, run: "" });
  assert.equal(runMissing.verified, false);
  assert.deepEqual(runMissing.checks, { release: true, acceptance: false, digest: true });
  assert.match(runMissing.problems[0]!, /is not an https URL/);
});

test("the CLI prints the verified state and exits 0", () => {
  const result = cli(state);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /^Verified GitHub Release v0\.2\.3: post-publish acceptance passed/);
  assert.ok(result.stdout.includes(run));
  assert.ok(result.stdout.includes(`sha256:${digest}`));
  assert.equal(result.stderr, "");
});

test("the CLI exits 1 and claims nothing verified when evidence is missing", () => {
  const result = cli({ ...state, exists: false });
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /is not verified/);
  assert.match(result.stderr, /does not exist/);
});

/** Runs the CLI with one release state and returns its status and output. */
function cli(value: typeof state): { status: number | null; stdout: string; stderr: string } {
  const args = [
    script,
    "--tag", value.tag,
    "--exists", String(value.exists),
    "--run", value.run,
    "--accepted", value.accepted,
    "--published", value.published,
  ];
  return spawnSync(process.execPath, args, { encoding: "utf8" });
}
