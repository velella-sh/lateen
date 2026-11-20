import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { CASES } from "./cases.ts";
import { gateProblems, type AcceptanceReport, type FeatureLedger } from "./ledger.ts";
import { root } from "../integration-helpers.ts";
import { identities } from "../../scripts/report.ts";

const ledger = JSON.parse(readFileSync(join(root, "test/acceptance/features.json"), "utf8")) as FeatureLedger;
const identity = identities();
const expected = { ...identity, commit: "c0ffee", digest: "abc123", mizzen: "0.2.3" };

const report = (over: Partial<AcceptanceReport> = {}): AcceptanceReport => ({
  ...identity,
  commit: expected.commit,
  digest: expected.digest,
  mizzen: expected.mizzen,
  tarball: "velella-lateen-0.3.0.tgz",
  ok: true,
  cases: CASES.map((item) => ({ name: item.name, ok: true })),
  ...over,
});

test("a complete report from the candidate tarball passes the gate", () => {
  assert.deepEqual(gateProblems(report(), expected, ledger), []);
});

test("a failed run, a missing case and a mismatched artifact block the gate", () => {
  assert.match(gateProblems(report({ ok: false }), expected, ledger).join("\n"), /did not pass/);
  assert.match(
    gateProblems(report({ cases: CASES.slice(1).map((item) => ({ name: item.name, ok: true })) }), expected, ledger).join("\n"),
    /no result for the shipped case/,
  );
  assert.match(gateProblems(report({ digest: "other" }), expected, ledger).join("\n"), /digest/);
  assert.match(gateProblems(report({ commit: "other" }), expected, ledger).join("\n"), /commit/);
  assert.match(gateProblems(report({ mizzen: "0.2.2" }), expected, ledger).join("\n"), /Mizzen/);
  assert.match(gateProblems(report({ node: "0.0.0" }), expected, ledger).join("\n"), /Node/);
  assert.match(gateProblems(report({ npm: "0.0.0" }), expected, ledger).join("\n"), /npm/);
  assert.match(gateProblems(report({ engines: { node: ">=99" } }), expected, ledger).join("\n"), /engine/);
  assert.match(
    gateProblems(report({ package: { name: expected.package.name, version: "9.9.9" } }), expected, ledger).join("\n"),
    /package/,
  );
  const { node: _node, ...missing } = report();
  assert.match(gateProblems(missing as AcceptanceReport, expected, ledger).join("\n"), /no Node version/);
});

test("the recorded identities are the running toolchain and this package", () => {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
    name: string;
    version: string;
    engines: { node: string };
  };
  const recorded = identities();
  assert.equal(recorded.node, process.versions.node);
  assert.equal(recorded.npm, execFileSync("npm", ["--version"], { encoding: "utf8" }).trim());
  assert.deepEqual(recorded.engines, { node: pkg.engines.node });
  assert.deepEqual(recorded.package, { name: pkg.name, version: pkg.version });
});

test("a failed case result blocks the gate even when the run says it passed", () => {
  const cases = CASES.map((item, index) => ({ name: item.name, ok: index !== 0, ...(index === 0 ? { error: "boom" } : {}) }));
  assert.match(gateProblems(report({ cases }), expected, ledger).join("\n"), /failed: boom/);
});
