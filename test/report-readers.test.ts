import assert from "node:assert/strict";
import { test } from "node:test";
import a11yReport from "../components/a11y-report/index.ts";
import { MAX_REPORT_BYTES, MAX_REPORT_NODES, reportAt } from "../src/report.ts";
import { pageIn, render, siteWith, text } from "./report-test-helpers.ts";

const TOOL = "lateen/a11y-report";

/** A report with only the header and the fields the accessibility reader requires. */
function report(): Record<string, unknown> {
  return {
    tool: TOOL,
    version: 1,
    commit: "de29199",
    tools: { node: "v24.0.0" },
    rules: [],
    matrix: [],
    findings: [],
    known: [],
    journeys: [],
    summary: { states: 0, findings: {}, journeys: {} },
  };
}

const boundaries = (data: unknown, from = "report") => reportAt(siteWith({ report: data }), from, TOOL);

/** The accessibility component with `data` under `from`; every state below must render its note. */
function missingNote(data: unknown): Element | null {
  return render(
    a11yReport({
      props: { from: "report" },
      site: siteWith(data === undefined ? {} : { report: data }),
      page: pageIn("en"),
      html: "",
    } as never),
  ).querySelector(".report-missing");
}

test("a report that carries its own header and stays inside the bounds is read", () => {
  assert.equal(boundaries(report())?.tool, TOOL);
  const doc = render(
    a11yReport({ props: { from: "report" }, site: siteWith({ report: report() }), page: pageIn("en"), html: "" } as never),
  );
  assert.ok(doc.querySelector(".a11y-report"));
  assert.equal(doc.querySelector(".report-missing"), null);
});

test("a missing report is absent, and so is one under another key", () => {
  assert.equal(boundaries(report(), "elsewhere"), undefined);
  assert.ok(missingNote(undefined));
});

test("a report written by another tool, or another version, is treated as missing", () => {
  assert.equal(boundaries({ ...report(), tool: "lateen/performance-report" }), undefined);
  assert.equal(boundaries({ ...report(), version: 2 }), undefined);
  assert.match(text(missingNote({ ...report(), tool: "lateen/performance-report" }) as Element), /no report report/);
});

test("array, null, and string data are malformed, not reports", () => {
  for (const data of [[report()], null, "report", 1, true]) {
    assert.equal(boundaries(data), undefined);
    assert.ok(missingNote(data));
  }
});

test("a report past the byte bound is not read", () => {
  const data = { ...report(), blob: "x".repeat(MAX_REPORT_BYTES) };
  assert.equal(boundaries(data), undefined);
  assert.ok(missingNote(data));
});

test("a report past the node bound is not read, and the exact bound still is", () => {
  const header = { tool: TOOL, version: 1 };
  const within = { ...header, rows: new Array(MAX_REPORT_NODES - 4).fill(0) };
  assert.ok(boundaries(within));
  const over = { ...header, rows: new Array(MAX_REPORT_NODES - 3).fill(0) };
  assert.equal(boundaries(over), undefined);
  assert.ok(missingNote(over));
});
