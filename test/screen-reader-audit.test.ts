// The checked-in screen-reader audit records three paths at desktop and mobile widths. The report
// must keep the role relationships a screen reader navigates and name the unresolved manual pass at
// every location, so a stale or partial audit fails here.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { CASES, VIEWPORTS, buildScreenReaderReport, missingRole } from "../scripts/audit-screen-reader.ts";
import { validate, type JsonSchema } from "../src/report-schema.ts";

const schema = JSON.parse(
  readFileSync(new URL("../schema/screen-reader-audit.schema.json", import.meta.url), "utf8"),
) as JsonSchema;

const report = JSON.parse(
  readFileSync(new URL("../test/accessibility/screen-reader.json", import.meta.url), "utf8"),
) as {
  commit: string;
  cases: { name: string; path: string; viewport: string; snapshot: string; finding?: string }[];
  findings: { location: string; note: string }[];
};

test("the audit covers every path at desktop and mobile and passes its schema", () => {
  assert.deepEqual(validate(schema, report), []);
  assert.match(report.commit, /^[0-9a-f]{7,40}$/);
  assert.deepEqual(
    report.cases.map((item) => `${item.name}/${item.viewport}`),
    CASES.flatMap((item) => VIEWPORTS.map((viewport) => `${item.name}/${viewport.name}`)),
  );
  for (const item of report.cases) {
    const entry = CASES.find((candidate) => candidate.name === item.name);
    const roles = item.viewport === "mobile" ? (entry?.mobileRoles ?? entry?.roles) : entry?.roles;
    assert.equal(missingRole(item.snapshot, roles ?? [], item.path, item.name), undefined);
  }
  assert.equal(report.findings.length, report.cases.length, "each path names the manual pass it could not perform");
  for (const finding of report.findings) {
    assert.match(finding.location, /^\/\S* (?:desktop|mobile)$/, "a finding names a reproducible path and viewport");
    assert.match(finding.note, /Spoken output/);
  }
});

test("a snapshot without a required role is reported with its path and selector", () => {
  assert.equal(missingRole("- table\n  - row\n    - rowheader \"Author\"", ["table", "rowheader"], "/compare/", "table"), undefined);
  assert.equal(
    missingRole("- table\n  - row\n    - cell \"Alpha\"", ["rowheader"], "/compare/", "table"),
    "/compare/ table has no rowheader in the accessibility tree",
  );
});

test("the report keeps case order and no clock", () => {
  const built = buildScreenReaderReport("abc1234", [
    { name: "search", path: "/", viewport: "desktop", snapshot: "- dialog", finding: "Spoken output was not captured." },
    { name: "compare", path: "/compare/", viewport: "mobile", snapshot: "- table" },
  ]);
  assert.deepEqual(Object.keys(built), ["tool", "version", "commit", "cases", "findings"]);
  assert.equal((built.cases as unknown[]).length, 2);
  assert.deepEqual((built.findings as { location: string }[]).map((item) => item.location), ["/ desktop"]);
});
