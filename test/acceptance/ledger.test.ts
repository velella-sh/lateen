import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { CASES } from "./cases.ts";
import { ledgerProblems, changelogProblems, type FeatureLedger } from "./ledger.ts";
import { root } from "../integration-helpers.ts";

const ledger = JSON.parse(readFileSync(join(root, "test/acceptance/features.json"), "utf8")) as FeatureLedger;

test("every shipped feature has an executable case and every deferred feature a reason", () => {
  assert.deepEqual(ledgerProblems(ledger, CASES), []);
  assert.ok(ledger.shipped.length > 0, "the ledger ships no feature");
  assert.ok(ledger.deferred.length > 0, "the ledger defers no feature");
});

test("the changelog does not list a deferred feature as shipped", () => {
  const changelog = readFileSync(join(root, "CHANGELOG.md"), "utf8");
  assert.deepEqual(changelogProblems(ledger, changelog), []);
});
