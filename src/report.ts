import type { Site, SiteConfig } from "@velella/mizzen/contracts";
import { isRecord, textOf as text } from "./guards.ts";

/**
 * Reading the reports the gates write. A report is untrusted input like any data file: every field is
 * checked before it is shown, a row with no usable value is dropped rather than printed as `undefined`,
 * and a report whose header is not this unit's own is treated as absent. The components render a
 * visible message for an absent report, never an empty table that reads like a clean result.
 */

/** A finite, non-negative number; anything else is undefined. */
export function count(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}

/** Only `http:` and `https:` links are rendered; a data file cannot inject any other scheme. */
export function safeHref(value: unknown): string | undefined {
  const href = text(value);
  if (href === undefined) return undefined;
  try {
    const url = new URL(href);
    return url.protocol === "https:" || url.protocol === "http:" ? href : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The value `from` names in `site.data`. Keys are separated by `/`, so a key that itself contains a
 * dot (a release version such as `0.3.0`) is one segment and needs no escaping: `reports/0.3.0/a11y`.
 * Empty segments are ignored, so a leading slash reads the same. `undefined` when a key is absent.
 */
export function dataAt(site: Site, from: string | undefined): unknown {
  const path = text(from);
  if (path === undefined) return undefined;
  let node: unknown = site.data;
  for (const key of path.split("/").filter((segment) => segment !== "")) {
    if (!isRecord(node) || !Object.prototype.hasOwnProperty.call(node, key)) return undefined;
    node = node[key];
  }
  return node;
}

/** A report is bounded before any field is read: a gate writes far less than this. */
export const MAX_REPORT_BYTES = 1024 * 1024;
export const MAX_REPORT_NODES = 20_000;

/** Whether `value` stays inside both report bounds; circular data is not a report. */
function bounded(value: unknown): boolean {
  try {
    if (JSON.stringify(value).length > MAX_REPORT_BYTES) return false;
  } catch {
    return false;
  }
  let nodes = 0;
  const stack: unknown[] = [value];
  while (stack.length > 0) {
    const node = stack.pop();
    if (++nodes > MAX_REPORT_NODES) return false;
    if (Array.isArray(node)) for (const item of node) stack.push(item);
    else if (isRecord(node)) for (const item of Object.values(node)) stack.push(item);
  }
  return true;
}

/**
 * The one boundary every report reader shares: the value `from` names in `site.data`, bounded, and
 * carrying `tool`'s version 1 header when the format has one. Each reader keeps its own view model;
 * a missing, oversized, malformed, or other unit's report reads as absent, so the component shows
 * its visible missing-report note.
 */
export function reportAt(
  site: Site,
  from: string | undefined,
  tool: string | undefined,
): Readonly<Record<string, unknown>> | undefined {
  const data = dataAt(site, from);
  if (!isRecord(data)) return undefined;
  if (tool !== undefined && (data.tool !== tool || data.version !== 1)) return undefined;
  return bounded(data) ? data : undefined;
}

export const A11Y_REPORT = "lateen/a11y-report";
export const PERFORMANCE_REPORT = "lateen/performance-report";

export type Impact = "minor" | "moderate" | "serious" | "critical";
export const IMPACTS: readonly Impact[] = ["critical", "serious", "moderate", "minor"];

export interface A11yFinding {
  readonly case: string;
  readonly theme: "light" | "dark";
  readonly rule: string;
  readonly impact: Impact;
  readonly target: string;
  readonly help: string;
  readonly helpUrl?: string;
}

export interface A11yKnown {
  readonly case: string;
  readonly theme: string;
  readonly rule: string;
  readonly target: string;
}

/** A journey runs in a chosen theme, or in the browser's own color scheme when no script can choose. */
export type JourneyTheme = "light" | "dark" | "system";

export interface A11yJourney {
  readonly name: string;
  readonly theme: JourneyTheme;
  readonly result: "pass" | "fail" | "skip";
  readonly detail?: string;
}

export interface A11yReport {
  readonly commit: string;
  readonly tools: readonly { readonly name: string; readonly version: string }[];
  readonly rules: readonly string[];
  readonly matrix: readonly { readonly case: string; readonly layout: string; readonly lang: string; readonly theme: string }[];
  readonly findings: readonly A11yFinding[];
  readonly known: readonly A11yKnown[];
  readonly journeys: readonly A11yJourney[];
  readonly summary: {
    readonly states: number;
    readonly findings: Readonly<Record<Impact, number>>;
    readonly journeys: Readonly<Record<"pass" | "fail" | "skip", number>>;
  };
}

function themeOf(value: unknown): "light" | "dark" | undefined {
  return value === "light" || value === "dark" ? value : undefined;
}

function impactOf(value: unknown): Impact | undefined {
  return value === "minor" || value === "moderate" || value === "serious" || value === "critical" ? value : undefined;
}

function journeyThemeOf(value: unknown): JourneyTheme | undefined {
  return value === "light" || value === "dark" || value === "system" ? value : undefined;
}

function resultOf(value: unknown): "pass" | "fail" | "skip" | undefined {
  return value === "pass" || value === "fail" || value === "skip" ? value : undefined;
}

/** The accessibility report at `from`, or undefined when the data is not one this unit wrote. */
export function a11yReportOf(site: Site, from: string | undefined): A11yReport | undefined {
  const data = reportAt(site, from, A11Y_REPORT);
  if (data === undefined) return undefined;
  const commit = text(data.commit);
  const summary = isRecord(data.summary) ? data.summary : undefined;
  const findings = isRecord(summary?.findings) ? summary.findings : undefined;
  const journeys = isRecord(summary?.journeys) ? summary.journeys : undefined;
  const states = count(summary?.states);
  if (commit === undefined || states === undefined || findings === undefined || journeys === undefined) return undefined;

  const toolRows = isRecord(data.tools)
    ? Object.entries(data.tools).flatMap(([name, version]) => {
        const value = text(version);
        return value === undefined ? [] : [{ name, version: value }];
      })
    : [];

  const matrix = Array.isArray(data.matrix)
    ? data.matrix.flatMap((row) => {
        if (!isRecord(row)) return [];
        const name = text(row.case);
        const layout = text(row.layout);
        const lang = text(row.lang);
        const theme = themeOf(row.theme);
        return name === undefined || layout === undefined || lang === undefined || theme === undefined
          ? []
          : [{ case: name, layout, lang, theme }];
      })
    : [];

  const findingRows = Array.isArray(data.findings)
    ? data.findings.flatMap((row) => {
        if (!isRecord(row)) return [];
        const name = text(row.case);
        const theme = themeOf(row.theme);
        const rule = text(row.rule);
        const impact = impactOf(row.impact);
        const target = text(row.target);
        const help = text(row.help);
        if (name === undefined || theme === undefined || rule === undefined || impact === undefined || target === undefined || help === undefined) {
          return [];
        }
        const helpUrl = safeHref(row.helpUrl);
        return [{ case: name, theme, rule, impact, target, help, ...(helpUrl === undefined ? {} : { helpUrl }) }];
      })
    : [];

  const known = Array.isArray(data.known)
    ? data.known.flatMap((row) => {
        if (!isRecord(row)) return [];
        const name = text(row.case);
        const theme = text(row.theme);
        const rule = text(row.rule);
        const target = text(row.target);
        return name === undefined || theme === undefined || rule === undefined || target === undefined
          ? []
          : [{ case: name, theme, rule, target }];
      })
    : [];

  const journeyRows = Array.isArray(data.journeys)
    ? data.journeys.flatMap((row) => {
        if (!isRecord(row)) return [];
        const name = text(row.name);
        const theme = journeyThemeOf(row.theme);
        const result = resultOf(row.result);
        if (name === undefined || theme === undefined || result === undefined) return [];
        const detail = text(row.detail);
        return [{ name, theme, result, ...(detail === undefined ? {} : { detail }) }];
      })
    : [];

  // Counts come from the rows themselves: a data file cannot say "no findings" while listing some.
  const impactCounts = Object.fromEntries(
    IMPACTS.map((impact) => [impact, findingRows.filter((finding) => finding.impact === impact).length]),
  ) as Record<Impact, number>;
  const journeyCounts = Object.fromEntries(
    (["pass", "fail", "skip"] as const).map((result) => [result, journeyRows.filter((journey) => journey.result === result).length]),
  ) as Record<"pass" | "fail" | "skip", number>;

  return {
    commit,
    tools: toolRows,
    rules: Array.isArray(data.rules) ? data.rules.flatMap((rule) => text(rule) ?? []) : [],
    matrix,
    findings: findingRows,
    known,
    journeys: journeyRows,
    summary: { states: matrix.length, findings: impactCounts, journeys: journeyCounts },
  };
}

export interface BudgetMeasurement {
  readonly name: string;
  /** Raw bytes. The report's own claim is about gzip; raw is kept so a reader can compare. */
  readonly raw: number;
  readonly gzip: number;
  readonly count: number;
  readonly budget?: { readonly gzip: number; readonly count: number };
}

export interface BudgetRoute {
  readonly route: string;
  readonly classes: readonly BudgetMeasurement[];
}

export interface BudgetTotals {
  readonly route: string;
  readonly javascript: { readonly raw: number; readonly gzip: number };
  readonly css: { readonly raw: number; readonly gzip: number };
}

export interface PerformanceReport {
  readonly commit: string;
  readonly tolerance: number;
  readonly routes: readonly BudgetRoute[];
  readonly totals: readonly BudgetTotals[];
}

function measurementOf(value: unknown): BudgetMeasurement | undefined {
  if (!isRecord(value)) return undefined;
  const name = text(value.name);
  const raw = count(value.raw);
  const gzip = count(value.gzip);
  const assets = count(value.count);
  if (name === undefined || raw === undefined || gzip === undefined || assets === undefined) return undefined;
  const budget = isRecord(value.budget) ? { gzip: count(value.budget.gzip), count: count(value.budget.count) } : undefined;
  return {
    name,
    raw,
    gzip,
    count: assets,
    ...(budget?.gzip === undefined || budget.count === undefined ? {} : { budget: { gzip: budget.gzip, count: budget.count } }),
  };
}

function bytesOf(value: unknown): { raw: number; gzip: number } | undefined {
  if (!isRecord(value)) return undefined;
  const raw = count(value.raw);
  const gzip = count(value.gzip);
  return raw === undefined || gzip === undefined ? undefined : { raw, gzip };
}

/** The performance report at `from`, or undefined when the data is not one this unit wrote. */
export function performanceReportOf(site: Site, from: string | undefined): PerformanceReport | undefined {
  const data = reportAt(site, from, PERFORMANCE_REPORT);
  if (data === undefined) return undefined;
  const commit = text(data.commit);
  const tolerance = count(data.tolerance);
  if (commit === undefined || tolerance === undefined) return undefined;

  const routes = Array.isArray(data.routes)
    ? data.routes.flatMap((row) => {
        if (!isRecord(row)) return [];
        const route = text(row.route);
        if (route === undefined) return [];
        const classes = Array.isArray(row.classes) ? row.classes.flatMap((item) => measurementOf(item) ?? []) : [];
        return [{ route, classes }];
      })
    : [];

  const totals = Array.isArray(data.totals)
    ? data.totals.flatMap((row) => {
        if (!isRecord(row)) return [];
        const route = text(row.route);
        const javascript = bytesOf(row.javascript);
        const css = bytesOf(row.css);
        return route === undefined || javascript === undefined || css === undefined ? [] : [{ route, javascript, css }];
      })
    : [];

  return { commit, tolerance, routes, totals };
}

export type CheckHow = "automated" | "manual" | "not-applicable";
export type Principle = "perceivable" | "operable" | "understandable" | "robust";

export interface WcagCheck {
  readonly id: string;
  readonly principle: Principle;
  readonly name: string;
  readonly level: "A" | "AA";
  readonly url: string;
  readonly how: CheckHow;
  readonly notes: string;
  readonly checked?: { readonly date: string; readonly version: string; readonly evidence: string };
}

function principleOf(value: unknown): Principle | undefined {
  return value === "perceivable" || value === "operable" || value === "understandable" || value === "robust" ? value : undefined;
}

function howOf(value: unknown): CheckHow | undefined {
  return value === "automated" || value === "manual" || value === "not-applicable" ? value : undefined;
}

/** The checklist at `from`, or undefined when the data is not a readable criteria list. */
export function wcagChecksOf(site: Site, from: string | undefined): readonly WcagCheck[] | undefined {
  const data = reportAt(site, from, undefined);
  if (data === undefined || !Array.isArray(data.criteria)) return undefined;
  const checks = data.criteria.flatMap((row) => {
    if (!isRecord(row)) return [];
    const id = text(row.id);
    const principle = principleOf(row.principle);
    const name = text(row.name);
    const level: "A" | "AA" | undefined = row.level === "A" ? "A" : row.level === "AA" ? "AA" : undefined;
    const url = safeHref(row.url);
    const how = howOf(row.how);
    const notes = text(row.notes);
    if (id === undefined || principle === undefined || name === undefined || level === undefined || url === undefined || how === undefined || notes === undefined) {
      return [];
    }
    const checked = isRecord(row.checked) ? row.checked : undefined;
    const date = text(checked?.date);
    const version = text(checked?.version);
    const evidence = safeHref(checked?.evidence);
    return [
      {
        id,
        principle,
        name,
        level,
        url,
        how,
        notes,
        ...(date === undefined || version === undefined || evidence === undefined ? {} : { checked: { date, version, evidence } }),
      },
    ];
  });
  return checks.length > 0 ? checks : undefined;
}

/** A count in the page language's own digits. */
export function formatNumber(lang: string, value: number): string {
  try {
    return new Intl.NumberFormat(lang).format(value);
  } catch {
    return String(value);
  }
}

/** Bytes as a number in the page language's digits, with the unit the budget uses. */
export function formatBytes(lang: string, value: number): string {
  return `${formatNumber(lang, value)} B`;
}

/** The commit's web page on the repository host, when the site names a GitHub or GitLab repository. */
export function commitHref(config: SiteConfig, commit: string): string | undefined {
  const repository = config.repository;
  if (repository === undefined) return undefined;
  let host: string;
  try {
    const url = new URL(repository.url);
    if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
    host = url.hostname.toLowerCase();
  } catch {
    return undefined;
  }
  // The same URL shape `chrome/edit-page` uses: GitLab keeps its web paths behind `/-/`.
  const root = repository.url.trim().replace(/\/+$/, "").replace(/\.git$/, "");
  if (host.includes("github")) return `${root}/commit/${encodeURIComponent(commit)}`;
  if (host.includes("gitlab")) return `${root}/-/commit/${encodeURIComponent(commit)}`;
  return undefined;
}
