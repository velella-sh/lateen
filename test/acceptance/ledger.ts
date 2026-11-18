/**
 * The feature ledger and the two gates built on it: every shipped feature names an executable
 * acceptance case, every deferred feature has a reason and cannot be listed as shipped, and a
 * release report must cover every shipped case with the candidate's own commit and engine.
 */
import type { AcceptanceCase } from "./cases.ts";

/** One feature in the release scope. */
export interface ShippedFeature {
  readonly feature: string;
  readonly issues: readonly number[];
  readonly case: string;
}

/** One feature that is not externally usable yet. */
export interface DeferredFeature {
  readonly feature: string;
  readonly issues: readonly number[];
  readonly reason: string;
}

/** The release scope as data. */
export interface FeatureLedger {
  readonly shipped: readonly ShippedFeature[];
  readonly deferred: readonly DeferredFeature[];
}

/** One case's outcome in a release report. */
export interface CaseResult {
  readonly name: string;
  readonly ok: boolean;
  readonly error?: string;
}

/** What a candidate acceptance run records. */
export interface AcceptanceReport {
  readonly commit: string;
  readonly digest: string;
  readonly mizzen: string;
  readonly tarball: string;
  readonly ok: boolean;
  readonly cases: readonly CaseResult[];
}

/** The ledger's own problems: a shipped feature without a case, or a deferred one without a reason. */
export function ledgerProblems(ledger: FeatureLedger, cases: readonly AcceptanceCase[]): string[] {
  const problems: string[] = [];
  const names = new Set(cases.map((item) => item.name));
  const used = new Set<string>();
  for (const feature of ledger.shipped) {
    if (!names.has(feature.case)) problems.push(`"${feature.feature}" names the missing acceptance case "${feature.case}"`);
    if (used.has(feature.case)) problems.push(`"${feature.case}" is used by more than one shipped feature`);
    used.add(feature.case);
    if (feature.issues.length === 0) problems.push(`"${feature.feature}" names no issue`);
  }
  for (const feature of ledger.deferred) {
    if (feature.reason.trim() === "") problems.push(`deferred feature "${feature.feature}" has no reason`);
    if (feature.issues.length === 0) problems.push(`deferred feature "${feature.feature}" names no issue`);
    if (names.has(feature.feature)) problems.push(`deferred feature "${feature.feature}" also appears as a case`);
  }
  return problems;
}

/** A deferred feature named in a `- ` bullet of the changelog would read as shipped. */
export function changelogProblems(ledger: FeatureLedger, changelog: string): string[] {
  const bullets = changelog
    .split("\n")
    .filter((line) => /^\s*[-*]\s/.test(line))
    .map((line) => line.toLowerCase());
  return ledger.deferred
    .filter((feature) => bullets.some((line) => line.includes(feature.feature.toLowerCase())))
    .map((feature) => `the changelog lists the deferred feature "${feature.feature}" as shipped`);
}

/** Why a release report cannot gate publishing. Empty when it can. */
export function gateProblems(
  report: AcceptanceReport,
  expected: { readonly commit: string; readonly digest: string; readonly mizzen: string },
  ledger: FeatureLedger,
): string[] {
  const problems: string[] = [];
  if (!report.ok) problems.push("the acceptance run did not pass");
  if (report.commit !== expected.commit) problems.push(`the report is for commit ${report.commit}, not ${expected.commit}`);
  if (report.digest !== expected.digest) problems.push("the report's tarball digest is not the candidate tarball's digest");
  if (report.mizzen !== expected.mizzen) problems.push(`the report used Mizzen ${report.mizzen}, not ${expected.mizzen}`);
  const results = new Map(report.cases.map((item) => [item.name, item]));
  for (const feature of ledger.shipped) {
    const result = results.get(feature.case);
    if (result === undefined) problems.push(`the report has no result for the shipped case "${feature.case}"`);
    else if (!result.ok) problems.push(`the shipped case "${feature.case}" failed: ${result.error ?? "no reason given"}`);
  }
  return problems;
}
