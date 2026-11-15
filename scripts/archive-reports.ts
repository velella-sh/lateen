// Archives the two reports of one released version and keeps the page that lists them in step.
// Usage: node scripts/archive-reports.ts <version> --a11y <file> --performance <file>
//
// The reports are copied to `site/_data/reports/<version>/`, the index records each file's SHA-256 and
// the version's JavaScript and CSS gzip totals, and a page under `site/reports/<version>/` renders the
// pair. A version that is already stored is never rewritten: the archive is evidence, not a draft.
// `test/reports-archive.test.ts` checks every stored file against its hash.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse, stringify } from "yaml";
import { validate, type JsonSchema } from "../src/report-schema.ts";
import { root, schemaAt } from "./report.ts";

const REPORTS = "site/_data/reports";
const PAGE = "site/reports.md";
const START = "<!-- reports:start -->";
const END = "<!-- reports:end -->";

/** One stored release: its files, their hashes, and the two gzip totals the index page compares. */
export interface ReleaseEntry {
  readonly version: string;
  readonly a11y: { readonly file: string; readonly sha256: string };
  readonly performance: { readonly file: string; readonly sha256: string };
  readonly totals: { readonly javascript: number; readonly css: number };
}

export interface ReportIndex {
  readonly releases: readonly ReleaseEntry[];
}

const sha256 = (file: string): string => createHash("sha256").update(readFileSync(file)).digest("hex");

/** The reports index under `dir`, or no releases when the file is absent. */
export function readIndex(dir: string): ReportIndex {
  const file = join(dir, "index.yml");
  if (!existsSync(file)) return { releases: [] };
  const parsed = parse(readFileSync(file, "utf8")) as { releases?: unknown } | null;
  const releases = Array.isArray(parsed?.releases) ? (parsed?.releases as ReleaseEntry[]) : [];
  return { releases };
}

/** Every reason the stored archive is not the one the index records: a missing file, an edited file, a duplicate. */
export function verifyArchive(dir: string): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const release of readIndex(dir).releases) {
    if (seen.has(release.version)) problems.push(`${release.version}: the index lists this version twice`);
    seen.add(release.version);
    for (const kind of ["a11y", "performance"] as const) {
      const record = release[kind];
      const file = join(dir, release.version, record.file);
      if (!existsSync(file)) {
        problems.push(`${release.version}/${record.file}: the index records it, but the file is missing`);
        continue;
      }
      if (sha256(file) !== record.sha256) problems.push(`${release.version}/${record.file}: the file changed after it was archived`);
    }
  }
  return problems;
}

/** Numbers in the page's own table, grouped by thousands as the rest of the site writes them. */
const number = (value: number): string => value.toLocaleString("en-US");

const sum = (values: readonly number[]): number => values.reduce((total, value) => total + value, 0);

/** The JavaScript and CSS gzip totals of a performance report, over its routes. */
export function totalsOf(report: unknown): { javascript: number; css: number } {
  const totals = (report as { totals?: { javascript?: { gzip?: number }; css?: { gzip?: number } }[] }).totals ?? [];
  return { javascript: sum(totals.map((item) => item.javascript?.gzip ?? 0)), css: sum(totals.map((item) => item.css?.gzip ?? 0)) };
}

/** The table on `site/reports.md`, rebuilt from the index; an empty archive says so. */
export function tableOf(releases: readonly ReleaseEntry[]): string {
  const rows = ["| Version | Reports | JavaScript gzip | CSS gzip | Change |", "| --- | --- | --- | --- | --- |"];
  let previous: ReleaseEntry | undefined;
  for (const release of releases) {
    const change =
      previous === undefined
        ? "—"
        : [
            `${release.totals.javascript - previous.totals.javascript >= 0 ? "+" : "−"}${number(Math.abs(release.totals.javascript - previous.totals.javascript))} B JavaScript`,
            `${release.totals.css - previous.totals.css >= 0 ? "+" : "−"}${number(Math.abs(release.totals.css - previous.totals.css))} B CSS`,
          ].join(", ");
    rows.push(
      `| [${release.version}](/reports/${release.version}/) | [accessibility and performance](/reports/${release.version}/) | ${number(release.totals.javascript)} B | ${number(release.totals.css)} B | ${change} |`,
    );
    previous = release;
  }
  return rows.join("\n");
}

/** The index page with its table replaced; the prose around the markers is untouched. */
function pageWith(text: string, table: string): string {
  const start = text.indexOf(START);
  const end = text.indexOf(END);
  if (start === -1 || end === -1 || end < start) throw new Error(`${PAGE}: the reports table markers are missing`);
  return `${text.slice(0, start + START.length)}\n${table}\n${text.slice(end)}`;
}

/** One release page that renders the stored pair. */
function releasePage(version: string): string {
  return `---
title: Reports for ${version}
description: The accessibility and performance reports stored for version ${version}.
layout: doc
permalink: /reports/${version}/
---

The two reports this version shipped with. They are stored under \`site/_data/reports/${version}/\` and
their hashes are recorded in the archive index, so a later release cannot quietly replace them.

::a11y-report{from=reports.${version}.a11y}

::budget-report{from=reports.${version}.performance}
`;
}

/** Validates one report file and returns its parsed value. */
function readReport(file: string, schemaName: string): unknown {
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error(`${file}: ${(error as Error).message}`);
  }
  const problems = validate(schemaAt(schemaName) as JsonSchema, value);
  if (problems.length > 0) throw new Error(`${file} does not satisfy ${schemaName}:\n- ${problems.join("\n- ")}`);
  return value;
}

/** Stores a release's reports, refuses to overwrite one, and rebuilds the index page. */
export function archive(version: string, a11yFile: string, performanceFile: string): void {
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error(`"${version}" is not a release version such as 0.3.0`);
  const dir = join(root, REPORTS);
  const target = join(dir, version);
  if (existsSync(target)) throw new Error(`${version}: already stored; an archived report is never rewritten`);

  const a11y = readReport(a11yFile, "a11y-report.schema.json");
  const performance = readReport(performanceFile, "performance-report.schema.json");
  mkdirSync(target, { recursive: true });
  writeFileSync(join(target, "a11y.json"), `${JSON.stringify(a11y, null, 2)}\n`);
  writeFileSync(join(target, "performance.json"), `${JSON.stringify(performance, null, 2)}\n`);

  const index = readIndex(dir);
  const releases = [
    ...index.releases,
    {
      version,
      a11y: { file: "a11y.json", sha256: sha256(join(target, "a11y.json")) },
      performance: { file: "performance.json", sha256: sha256(join(target, "performance.json")) },
      totals: totalsOf(performance),
    },
  ].sort((a, b) => {
    const left = a.version.split(".").map(Number);
    const right = b.version.split(".").map(Number);
    for (let index = 0; index < 3; index += 1) if (left[index] !== right[index]) return (left[index] ?? 0) - (right[index] ?? 0);
    return 0;
  });
  writeFileSync(join(dir, "index.yml"), stringify({ releases }, { lineWidth: 0 }));
  writeFileSync(join(root, PAGE), pageWith(readFileSync(join(root, PAGE), "utf8"), tableOf(releases)));
  mkdirSync(join(root, "site/reports", version), { recursive: true });
  writeFileSync(join(root, "site/reports", version, "index.md"), releasePage(version));
  console.log(`stored ${version} and updated ${PAGE}`);
}

/** The `--a11y` and `--performance` values that follow their flags. */
export function filesFrom(argv: readonly string[]): { version: string; a11y: string; performance: string } {
  const version = argv[0] ?? "";
  const value = (flag: string): string => {
    const index = argv.indexOf(flag);
    const found = index === -1 ? undefined : argv[index + 1];
    if (found === undefined || found.trim() === "") throw new Error(`${flag} needs a report file`);
    return found;
  };
  return { version, a11y: value("--a11y"), performance: value("--performance") };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const files = filesFrom(process.argv.slice(2));
    archive(files.version, files.a11y, files.performance);
  } catch (error) {
    console.error(`FAIL: ${(error as Error).message}`);
    process.exitCode = 1;
  }
}
