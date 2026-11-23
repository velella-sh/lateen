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
  /** Implementation PR when the approved work has no separate issue. */
  readonly pullRequest?: number;
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

/** The exact runtime, declared engine and package a report was produced with. */
export interface Identities {
  readonly node: string;
  readonly npm: string;
  readonly engines: { readonly node: string };
  readonly package: { readonly name: string; readonly version: string };
}

/** What a candidate acceptance run records. */
export interface AcceptanceReport extends Identities {
  readonly commit: string;
  readonly digest: string;
  readonly mizzen: string;
  readonly tarball: string;
  readonly ok: boolean;
  readonly cases: readonly CaseResult[];
}

/** Why a report does not identify the toolchain and package that produced it. Empty when it does. */
export function identityProblems(report: AcceptanceReport, expected: Identities): string[] {
  const problems: string[] = [];
  if (!report.node) problems.push("the report records no Node version");
  else if (report.node !== expected.node) problems.push(`the report used Node ${report.node}, not ${expected.node}`);
  if (!report.npm) problems.push("the report records no npm version");
  else if (report.npm !== expected.npm) problems.push(`the report used npm ${report.npm}, not ${expected.npm}`);
  if (report.engines?.node !== expected.engines.node) {
    problems.push(`the report records engine ${report.engines?.node ?? "none"}, not ${expected.engines.node}`);
  }
  if (report.package?.name !== expected.package.name || report.package?.version !== expected.package.version) {
    const found = report.package ? `${report.package.name}@${report.package.version}` : "none";
    problems.push(`the report records package ${found}, not ${expected.package.name}@${expected.package.version}`);
  }
  return problems;
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
    const pull = feature.pullRequest;
    if (feature.issues.length === 0 && (pull === undefined || !Number.isSafeInteger(pull) || pull < 1)) {
      problems.push(`"${feature.feature}" names no issue or implementation PR`);
    }
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
  expected: { readonly commit: string; readonly digest: string; readonly mizzen: string } & Identities,
  ledger: FeatureLedger,
  additionalCases: readonly string[] = [],
): string[] {
  const problems: string[] = [];
  if (!report.ok) problems.push("the acceptance run did not pass");
  if (report.commit !== expected.commit) problems.push(`the report is for commit ${report.commit}, not ${expected.commit}`);
  if (report.digest !== expected.digest) problems.push("the report's tarball digest is not the candidate tarball's digest");
  if (report.mizzen !== expected.mizzen) problems.push(`the report used Mizzen ${report.mizzen}, not ${expected.mizzen}`);
  problems.push(...identityProblems(report, expected));
  const results = new Map(report.cases.map((item) => [item.name, item]));
  for (const name of [...ledger.shipped.map((feature) => feature.case), ...additionalCases]) {
    const result = results.get(name);
    if (result === undefined) problems.push(`the report has no result for the shipped case "${name}"`);
    else if (!result.ok) problems.push(`the shipped case "${name}" failed: ${result.error ?? "no reason given"}`);
  }
  return problems;
}
