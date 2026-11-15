import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  CASES,
  THEMES,
  buildA11yReport,
  reportFindingsFrom,
  type A11yReportInput,
  type ReportFinding,
} from "../scripts/test-a11y.ts";
import { validate, type JsonSchema } from "../src/report-schema.ts";

const schema = JSON.parse(readFileSync(new URL("../schema/a11y-report.schema.json", import.meta.url), "utf8")) as JsonSchema;

const finding: ReportFinding = {
  case: "docs home",
  theme: "light",
  rule: "color-contrast",
  impact: "serious",
  target: ".eyebrow",
  help: "Contrast",
  helpUrl: "https://dequeuniversity.com/rules/axe/4.14/color-contrast",
};

const input: A11yReportInput = {
  commit: "de29199",
  tools: { node: "v24.0.0", playwright: "1.65.0", axe: "4.14.0", chromium: "140.0.0" },
  cases: CASES,
  themes: THEMES,
  findings: [finding, { ...finding, case: "docs document", theme: "dark", impact: "minor", target: ".note" }],
  known: [{ case: "*", theme: "dark", rule: "region", target: "main" }],
  journeys: [
    { name: "search the site", theme: "dark", result: "pass" },
    { name: "search the site", theme: "light", result: "fail", detail: "the field did not open" },
  ],
};

test("the report satisfies schema/a11y-report.schema.json and carries no clock", () => {
  const report = buildA11yReport(input);
  assert.deepEqual(validate(schema, report), []);
  assert.equal(JSON.stringify(report).includes("generatedAt"), false);
});

test("the matrix is one row per case and theme, in a stable order", () => {
  const report = buildA11yReport(input) as { matrix: { case: string; theme: string }[]; summary: { states: number } };
  assert.equal(report.matrix.length, CASES.length * THEMES.length);
  assert.equal(report.summary.states, CASES.length * THEMES.length);
  const keys = report.matrix.map((row) => [row.case, row.theme] as const);
  const sorted = [...keys].sort((a, b) => (a[0] === b[0] ? (a[1] < b[1] ? -1 : 1) : a[0] < b[0] ? -1 : 1));
  assert.deepEqual(keys, sorted);
});

test("every impact is counted, and two runs on the same commit write the same file", () => {
  const first = buildA11yReport(input);
  const second = buildA11yReport({
    ...input,
    findings: [...input.findings].reverse(),
    known: [...input.known].reverse(),
    journeys: [...input.journeys].reverse(),
  });
  assert.equal(JSON.stringify(second), JSON.stringify(first));
  assert.deepEqual((first as { summary: { findings: Record<string, number> } }).summary.findings, {
    minor: 1,
    moderate: 0,
    serious: 1,
    critical: 0,
  });
  assert.deepEqual(
    (first as { findings: { impact: string }[] }).findings.map((item) => item.impact),
    ["minor", "serious"],
    "findings sort by case, not by the order axe returned them",
  );
});

test("journey results are counted and a failure keeps its detail", () => {
  const report = buildA11yReport(input) as {
    journeys: { name: string; theme: string; result: string; detail?: string }[];
    summary: { journeys: Record<string, number> };
  };
  assert.deepEqual(report.summary.journeys, { pass: 1, fail: 1, skip: 0 });
  assert.ok(report.journeys.every((journey) => journey.name === "search the site"));
  assert.equal(report.journeys.find((journey) => journey.result === "fail")?.detail, "the field did not open");
});

test("the report keeps moderate and minor findings, and leaves out an impact axe did not name", () => {
  const item = CASES[0]!;
  const violations = [
    {
      id: "color-contrast",
      impact: "moderate",
      help: "Contrast",
      helpUrl: "https://example.com/contrast",
      nodes: [{ target: [".a"] }],
    },
    {
      id: "region",
      impact: "minor",
      help: "Regions",
      helpUrl: "https://example.com/region",
      nodes: [{ target: [["iframe", "main"]] }],
    },
    { id: "unknown", impact: null, help: "Unknown", helpUrl: "https://example.com/unknown", nodes: [{ target: ["main"] }] },
  ];
  assert.deepEqual(
    reportFindingsFrom(item, "dark", violations).map((entry) => [entry.rule, entry.impact, entry.target]),
    [
      ["color-contrast", "moderate", ".a"],
      ["region", "minor", "iframe >>> main"],
    ],
  );
});
