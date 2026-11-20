import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { GATES, cleanProblems, gateProblems, type CandidateReport, type GateResult } from "../scripts/release-candidate.ts";
import { validate, type JsonSchema } from "../src/report-schema.ts";

const schema = JSON.parse(readFileSync(new URL("../schema/release-candidate.schema.json", import.meta.url), "utf8")) as JsonSchema;

const result = (name: string, status: "passed" | "failed" = "passed"): GateResult => ({
  name,
  command: `run ${name}`,
  status,
});

test("a clean checkout is required and every dirty line is named", () => {
  assert.deepEqual(cleanProblems(""), []);
  assert.deepEqual(cleanProblems("\n"), []);
  const problems = cleanProblems(" M src/a.ts\n?? scratch.txt\n");
  assert.equal(problems.length, 2);
  assert.ok(problems[0]!.includes("src/a.ts"));
  assert.ok(problems[1]!.includes("scratch.txt"));
  assert.ok(problems.every((problem) => problem.startsWith("the release candidate must be a clean checkout")));
});

test("the gate list covers the release checks in order", () => {
  assert.deepEqual(
    GATES.map((gate) => gate.name),
    ["install", "browsers", "typecheck", "test", "a11y", "performance", "visual", "acceptance", "mizzen"],
  );
  assert.ok(GATES.every((gate) => gate.command.trim() !== ""));
  assert.equal(new Set(GATES.map((gate) => gate.name)).size, GATES.length, "no gate is listed twice");
});

test("a failed gate names its command, and a passed run names nothing", () => {
  assert.deepEqual(gateProblems([result("test"), result("a11y")]), []);
  const failed = gateProblems([result("test"), result("a11y", "failed")]);
  assert.deepEqual(failed, ["a11y failed: run a11y"]);
});

test("a candidate report validates against the schema", () => {
  const report: CandidateReport = {
    tool: "lateen/release-candidate",
    version: 1,
    commit: "0123456789abcdef0123456789abcdef01234567",
    package: { name: "@velella/lateen", version: "0.2.3" },
    mizzen: "0.2.9",
    status: "passed",
    gates: GATES.map((gate) => ({ ...gate, status: "passed" })),
  };
  assert.deepEqual(validate(schema, report), []);

  assert.ok(validate(schema, { ...report, commit: "not-a-commit" }).length > 0);
  assert.ok(validate(schema, { ...report, status: "skipped" }).length > 0);
  assert.ok(validate(schema, { ...report, gates: [] }).length > 0);
});
