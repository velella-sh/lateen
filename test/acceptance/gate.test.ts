import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { CASES } from "./cases.ts";
import { gateProblems, type AcceptanceReport, type FeatureLedger } from "./ledger.ts";
import { root } from "../integration-helpers.ts";

const ledger = JSON.parse(readFileSync(join(root, "test/acceptance/features.json"), "utf8")) as FeatureLedger;
const expected = { commit: "c0ffee", digest: "abc123", mizzen: "0.2.3" };

const report = (over: Partial<AcceptanceReport> = {}): AcceptanceReport => ({
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
});

test("a failed case result blocks the gate even when the run says it passed", () => {
  const cases = CASES.map((item, index) => ({ name: item.name, ok: index !== 0, ...(index === 0 ? { error: "boom" } : {}) }));
  assert.match(gateProblems(report({ cases }), expected, ledger).join("\n"), /failed: boom/);
});
