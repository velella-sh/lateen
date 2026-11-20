// The step summary of the visual CI job (#882): reads test/visual/out/report.json (the rows
// scripts/test-visual.ts writes) and appends the page/entry/share table to $GITHUB_STEP_SUMMARY.
// The workflow only invokes this script; the table logic lives here so it is tested.
// Usage: node scripts/visual-summary.ts   (from the checkout root, with GITHUB_STEP_SUMMARY set)
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** The fields of a report row the table reads; anything else in the row is ignored. */
interface ReportRow {
  readonly page: string;
  readonly entry: string;
  readonly status: string;
  readonly share?: unknown;
  readonly flaky?: unknown;
}

/** A row the table can render: an object whose page, entry and status are strings. */
function isRow(value: unknown): value is ReportRow {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Record<string, unknown>;
  return typeof row["page"] === "string" && typeof row["entry"] === "string" && typeof row["status"] === "string";
}

/**
 * The markdown table of the report rows. A null (or unusable) share prints as an em dash, a flaky
 * case reports "flaky" instead of its status, and a malformed row is skipped so one bad row cannot
 * hide the rest of the gate's evidence.
 */
export function summaryTable(rows: readonly unknown[]): string {
  const lines = ["| Page | Matrix entry | Changed share | Result |", "| --- | --- | ---: | --- |"];
  for (const row of rows) {
    if (!isRow(row)) continue;
    const share = typeof row.share === "number" ? `${(row.share * 100).toFixed(3)}%` : "—";
    const result = row.flaky === true ? "flaky" : row.status;
    lines.push(`| ${row.page} | ${row.entry} | ${share} | ${result} |`);
  }
  return `${lines.join("\n")}\n`;
}

/**
 * Appends the visual gate's summary to `summaryFile`. A missing report says so; a report that is
 * not readable JSON or not an array of rows says that instead of failing the summary step, so the
 * failure evidence upload still runs.
 */
export function summarizeVisualGate(reportFile: string, summaryFile: string): void {
  if (!existsSync(reportFile)) {
    appendFileSync(summaryFile, "The visual gate wrote no report.\n");
    return;
  }
  let rows: unknown;
  try {
    rows = JSON.parse(readFileSync(reportFile, "utf8"));
  } catch {
    rows = undefined;
  }
  if (!Array.isArray(rows)) {
    appendFileSync(summaryFile, "The visual gate wrote no readable report.\n");
    return;
  }
  appendFileSync(summaryFile, summaryTable(rows));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const summary = process.env["GITHUB_STEP_SUMMARY"];
  if (summary === undefined) {
    console.error("GITHUB_STEP_SUMMARY is not set; this script writes the visual job's step summary on CI");
    process.exitCode = 1;
  } else {
    summarizeVisualGate("test/visual/out/report.json", summary);
  }
}