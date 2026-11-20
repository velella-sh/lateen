import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { selectTarball } from "../scripts/release-tarball.ts";

const script = fileURLToPath(new URL("../scripts/release-tarball.ts", import.meta.url));
const named = "velella-lateen-0.2.3.tgz";

test("exactly one tarball named by the report is selected", () => {
  assert.deepEqual(selectTarball(["report.json", named], named), { tarball: named, problems: [] });
});

test("zero tarballs is a problem, not an empty selection", () => {
  const { tarball, problems } = selectTarball(["report.json"], named);
  assert.equal(tarball, undefined);
  assert.deepEqual(problems, ["the artifact directory has no .tgz tarball"]);
});

test("several tarballs are refused and every name is listed", () => {
  const { tarball, problems } = selectTarball([named, "velella-lateen-0.2.4.tgz"], named);
  assert.equal(tarball, undefined);
  assert.equal(problems.length, 1);
  assert.match(problems[0]!, /2 \.tgz tarballs, expected exactly one/);
  assert.match(problems[0]!, /velella-lateen-0\.2\.3\.tgz/);
  assert.match(problems[0]!, /velella-lateen-0\.2\.4\.tgz/);
});

test("a tarball the report does not name is refused", () => {
  const { tarball, problems } = selectTarball(["velella-lateen-9.9.9.tgz"], named);
  assert.equal(tarball, undefined);
  assert.match(problems[0]!, /is not the acceptance report's tarball velella-lateen-0\.2\.3\.tgz/);
});

test("a report without a tarball name is refused", () => {
  for (const value of [undefined, "", "  ", 42]) {
    const { tarball, problems } = selectTarball([named], value);
    assert.equal(tarball, undefined);
    assert.deepEqual(problems, ["the acceptance report does not name a tarball"]);
  }
});

/** Runs the CLI against a temporary artifact directory and returns its status and output. */
function cli(files: readonly string[], report: unknown): { dir: string; status: number | null; stdout: string; stderr: string } {
  const dir = mkdtempSync(join(tmpdir(), "lateen-tarball-"));
  try {
    for (const file of files) writeFileSync(join(dir, file), "bytes");
    const reportFile = join(dir, "report.json");
    writeFileSync(reportFile, JSON.stringify(report));
    const run = spawnSync(process.execPath, [script, "--dir", dir, "--report", reportFile], { encoding: "utf8" });
    return { dir, status: run.status, stdout: run.stdout, stderr: run.stderr };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("the CLI prints the one accepted tarball path and exits 0", () => {
  const run = cli([named], { tarball: named });
  assert.equal(run.status, 0);
  assert.equal(run.stdout.trim(), join(run.dir, named));
  assert.equal(run.stderr, "");
});

test("the CLI exits 1 on zero, several, or misnamed tarballs", () => {
  assert.equal(cli([], { tarball: named }).status, 1);
  assert.equal(cli([named, "other.tgz"], { tarball: named }).status, 1);
  assert.equal(cli(["wrong.tgz"], { tarball: named }).status, 1);
  assert.equal(cli([named], {}).status, 1);
});