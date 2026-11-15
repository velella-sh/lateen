import { h } from "preact";
import type { Component } from "@velella/mizzen/contracts";
import { t } from "../../i18n/index.ts";
import {
  commitHref,
  formatBytes,
  formatNumber,
  performanceReportOf,
  type BudgetRoute,
  type PerformanceReport,
} from "../../src/report.ts";

/** The Markdown directive this component handles: `::budget-report{from=… targets=…}`. */
export const directive = "budget-report";

/** Default key in `site.data` when the directive names no `from`. */
export const DEFAULT_FROM = "performance-report";

export const OPTIONS = ["from", "targets"] as const;

export const CLASS = "budget-report";

export type BudgetReportProps = {
  /** Dot-separated key in `site.data` that holds the report; defaults to `performance-report`. */
  readonly from?: string;
  /**
   * Per-route JavaScript and CSS limits in gzip bytes, for the totals table:
   * `targets={"js":102400,"css":51200}` or `targets=js=102400,css=51200`.
   */
  readonly targets?: string;
};

/** A byte limit per asset kind. */
export interface Targets {
  readonly js?: number | undefined;
  readonly css?: number | undefined;
}

/** Reads a non-negative byte value from a JSON value; anything else is not a limit. */
function bytes(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}

/** The `targets` prop as limits: a JSON object, or `js=…,css=…`; an unreadable value sets none. */
export function targetsOf(raw: string | undefined): Targets {
  const value = raw?.trim() ?? "";
  if (value === "") return {};
  if (value.startsWith("{")) {
    try {
      const parsed: unknown = JSON.parse(value);
      if (typeof parsed !== "object" || parsed === null) return {};
      const record = parsed as Record<string, unknown>;
      return { ...(bytes(record.js) === undefined ? {} : { js: bytes(record.js) }), ...(bytes(record.css) === undefined ? {} : { css: bytes(record.css) }) };
    } catch {
      return {};
    }
  }
  const targets: { js?: number; css?: number } = {};
  for (const part of value.split(",")) {
    const [name, amount] = part.split("=").map((piece) => piece.trim());
    const number = amount === undefined ? NaN : Number(amount);
    if (!Number.isFinite(number) || number < 0) continue;
    if (name === "js") targets.js = number;
    if (name === "css") targets.css = number;
  }
  return targets;
}

/** Whether a route's JavaScript or CSS total is over a limit the page gave. */
export function overTarget(totals: PerformanceReport["totals"][number], targets: Targets): readonly ("js" | "css")[] {
  const over: ("js" | "css")[] = [];
  if (targets.js !== undefined && totals.javascript.gzip > targets.js) over.push("js");
  if (targets.css !== undefined && totals.css.gzip > targets.css) over.push("css");
  return over;
}

/** The width of a bar: the measured gzip as a share of the budget, capped at 100; a bar without one is hidden. */
function barWidth(gzip: number, budget: number | undefined): number | undefined {
  if (budget === undefined || budget <= 0) return undefined;
  return Math.min(100, Math.round((gzip / budget) * 100));
}

function bar(gzip: number, budget: number | undefined) {
  const width = barWidth(gzip, budget);
  if (width === undefined) return null;
  return h("span", { class: `${CLASS}-bar`, "aria-hidden": "true" }, h("span", { class: `${CLASS}-bar-fill`, style: `inline-size:${width}%` }));
}

/** A table inside a keyboard-scrollable region. */
function table(label: string, head: readonly string[], rows: readonly (readonly unknown[])[]) {
  return h(
    "div",
    { class: `${CLASS}-scroll`, role: "region", "aria-label": label, tabIndex: 0 },
    h(
      "table",
      { class: `${CLASS}-table` },
      h("caption", { class: `${CLASS}-caption` }, label),
      h("thead", null, h("tr", null, ...head.map((text) => h("th", { scope: "col" }, text)))),
      h(
        "tbody",
        null,
        ...rows.map((cells) => h("tr", null, ...cells.map((cell) => h("td", null, cell as never)))),
      ),
    ),
  );
}

/** One asset-class row with its measured bytes, its budget, and whether it is inside it. */
function classRow(route: string, item: BudgetRoute["classes"][number], tolerance: number, lang: string) {
  const budget = item.budget;
  const over =
    budget !== undefined && (item.gzip > budget.gzip + tolerance || item.count > budget.count);
  return [
    h("code", { dir: "ltr" }, route),
    h("code", { dir: "ltr" }, item.name),
    formatNumber(lang, item.count),
    formatBytes(lang, item.raw),
    formatBytes(lang, item.gzip),
    budget === undefined
      ? t(lang, "budget_report_no_budget")
      : `${formatBytes(lang, budget.gzip)} (${formatNumber(lang, budget.count)})`,
    budget === undefined
      ? null
      : over
        ? h("span", { class: `${CLASS}-over`, "data-over": "true" }, t(lang, "budget_report_over"))
        : h("span", { class: `${CLASS}-within` }, t(lang, "budget_report_within")),
    bar(item.gzip, budget?.gzip),
  ];
}

/**
 * The performance report of one commit: bytes per route and asset class against the checked-in
 * budget, the JavaScript and CSS totals per route, and the limits the page asked for. Every value is
 * text in the page language's digits, and a route that is over its target says so in words, never by
 * colour alone. It reads `site.data` and shows a visible message when the report is absent.
 */
const budgetReport: Component<BudgetReportProps> = ({ props, site, page }) => {
  const from = typeof props.from === "string" && props.from.trim() !== "" ? props.from.trim() : DEFAULT_FROM;
  const report = performanceReportOf(site, from);
  const lang = page.lang;
  if (report === undefined) {
    return h(
      "p",
      { class: "report-missing", role: "note", "data-report": from },
      t(lang, "report_missing", { name: from }),
    );
  }

  const commit = commitHref(site.config, report.commit);
  const targets = targetsOf(typeof props.targets === "string" ? props.targets : undefined);
  const totals = new Map(report.totals.map((entry) => [entry.route, entry]));
  const routes = report.routes.map((route) => ({
    route: route.route,
    classes: route.classes.map((item) => classRow(route.route, item, report.tolerance, lang)),
  }));
  const totalRows = [...totals.values()].map((entry) => {
    const over = overTarget(entry, targets);
    const result =
      targets.js === undefined && targets.css === undefined
        ? t(lang, "budget_report_no_target")
        : over.length === 0
          ? t(lang, "budget_report_inside")
          : `${t(lang, "budget_report_outside")}: ${over.map((name) => t(lang, name === "js" ? "budget_report_javascript" : "budget_report_css")).join(", ")}`;
    return [
      h("code", { dir: "ltr" }, entry.route),
      formatBytes(lang, entry.javascript.gzip),
      formatBytes(lang, entry.css.gzip),
      result,
    ];
  });

  return h(
    "section",
    { class: CLASS, "data-report": from },
    h("h2", null, t(lang, "budget_report_title")),
    h(
      "p",
      { class: `${CLASS}-summary` },
      t(lang, "budget_report_summary", { routes: formatNumber(lang, report.routes.length) }),
      " ",
      h(
        "span",
        { class: `${CLASS}-commit` },
        `${t(lang, "a11y_report_commit")}: `,
        commit === undefined ? h("code", { dir: "ltr" }, report.commit) : h("a", { href: commit, dir: "ltr" }, h("code", null, report.commit)),
      ),
      " ",
      h("span", { class: `${CLASS}-tolerance` }, t(lang, "budget_report_tolerance", { bytes: formatBytes(lang, report.tolerance) })),
    ),
    h("h3", null, t(lang, "budget_report_classes")),
    table(
      t(lang, "budget_report_classes"),
      [
        t(lang, "budget_report_route"),
        t(lang, "budget_report_class"),
        t(lang, "budget_report_files"),
        t(lang, "budget_report_raw"),
        t(lang, "budget_report_gzip"),
        t(lang, "budget_report_budget"),
        t(lang, "budget_report_state"),
        "",
      ],
      routes.flatMap((route) => route.classes),
    ),
    h("h3", null, t(lang, "budget_report_totals")),
    table(
      t(lang, "budget_report_totals"),
      [t(lang, "budget_report_route"), t(lang, "budget_report_javascript"), t(lang, "budget_report_css"), t(lang, "budget_report_targets")],
      totalRows,
    ),
  );
};

export default budgetReport;
