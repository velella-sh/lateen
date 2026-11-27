// The visual job's step summary is a tested script, not inline workflow YAML (#882): a missing
// report, a null share, a flaky case and malformed rows each have a defined rendering, and the
// workflow only invokes the script while the failure-evidence upload stays in place.
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { summarizeVisualGate, summaryTable } from "../scripts/visual-summary.ts";

const HEADER = "| Page | Matrix entry | Changed share | Result |\n| --- | --- | ---: | --- |";

const row = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  page: "Home",
  entry: "screen/light/desktop",
  case: "home-screen-light-desktop",
  status: "pass",
  share: 0,
  message: null,
  flaky: false,
  ...overrides,
});

test("the table renders a share as a percentage with three decimals", () => {
  const table = summaryTable([row({ share: 0.001234 })]);
  assert.equal(table, `${HEADER}\n| Home | screen/light/desktop | 0.123% | pass |\n`);
});

test("a null share prints an em dash, not a percentage", () => {
  const table = summaryTable([row({ status: "missing", share: null })]);
  assert.ok(table.includes("| Home | screen/light/desktop | — | missing |"));
});

test("a flaky case reports flaky instead of its status", () => {
  const table = summaryTable([row({ status: "fail", flaky: true, share: 0.2 })]);
  assert.ok(table.includes("| Home | screen/light/desktop | 20.000% | flaky |"));
});

test("malformed rows are skipped and the good rows still render", () => {
  const table = summaryTable([
    null,
    "not a row",
    42,
    { page: "No status", entry: "screen/light/desktop", share: 0 },
    { page: 7, entry: "screen/light/desktop", status: "pass", share: 0 },
    row({ page: "Gallery" }),
  ]);
  assert.equal(table, `${HEADER}\n| Gallery | screen/light/desktop | 0.000% | pass |\n`);
});

test("a malformed share prints an em dash instead of crashing the summary", () => {
  const table = summaryTable([row({ share: "lots" }), row({ page: "No share", share: undefined })]);
  assert.ok(table.includes("| Home | screen/light/desktop | — | pass |"));
  assert.ok(table.includes("| No share | screen/light/desktop | — | pass |"));
});

test("an empty report still writes the table header", () => {
  assert.equal(summaryTable([]), `${HEADER}\n`);
});

test("the summary file receives the report, a missing-report note, or a malformed-report note", () => {
  const dir = mkdtempSync(join(tmpdir(), "visual-summary-"));
  const report = join(dir, "report.json");
  const summary = join(dir, "summary.md");
  try {
    writeFileSync(summary, "");
    summarizeVisualGate(report, summary);
    assert.equal(readFileSync(summary, "utf8"), "The visual gate wrote no report.\n");

    writeFileSync(summary, "");
    writeFileSync(report, "{ not json");
    summarizeVisualGate(report, summary);
    assert.equal(readFileSync(summary, "utf8"), "The visual gate wrote no readable report.\n");

    writeFileSync(summary, "");
    writeFileSync(report, '{"rows":[]}');
    summarizeVisualGate(report, summary);
    assert.equal(readFileSync(summary, "utf8"), "The visual gate wrote no readable report.\n");

    writeFileSync(summary, "earlier steps\n");
    writeFileSync(report, JSON.stringify([row({ share: null, status: "fail" })]));
    summarizeVisualGate(report, summary);
    assert.equal(readFileSync(summary, "utf8"), `earlier steps\n${HEADER}\n| Home | screen/light/desktop | — | fail |\n`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the workflow invokes the script and uploads the images on every run, so report-only diffs stay reviewable", () => {
  const workflow = readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");
  assert.ok(workflow.includes("run: node scripts/visual-summary.ts"));
  assert.ok(!workflow.includes("--input-type=module"), "the inline summary script is gone");
  const upload = workflow.indexOf("name: Upload the visual review images");
  assert.ok(upload > workflow.indexOf("name: Summarize the visual gate"));
  assert.match(workflow.slice(upload), /if: always\(\)[\s\S]*?path: lateen\/test\/visual\/out/);
});